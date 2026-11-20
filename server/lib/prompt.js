const { looksLikeCrisis } = require('./moodSafety');

/**
 * Wake scripts that never feel like a template:
 * - the last 7–10 scripts go to the model as "do not repeat";
 * - a scenario is chosen in code BEFORE writing (never the same one twice
 *   in a row, only ones that fit the chosen voice style);
 * - one onboarding theme per script (rotated), never all habits/goals;
 * - the greeting stays familiar ("Good morning." / "Hey Anna, it's me."),
 *   everything after it is new.
 */

/** ~20 s spoken at the unhurried 0.92 voice speed. */
const LENGTH = { words: '45 to 55 words', max: 60, seconds: 'about 20 seconds' };

function lengthGuide() {
  return LENGTH;
}

const SCENARIOS = {
  support: 'Warm support: gentle, steady, on their side. Make getting up feel safe and easy.',
  humor: 'Light humor: one small, kind joke or playful observation about mornings or about themselves. Never sarcastic, never at their expense.',
  challenge: 'A small challenge: one tiny, doable dare for the next few minutes. Friendly, never pushy or guilt-based.',
  anticipation: 'Anticipation: point at something pleasant that today can hold (from their answers, never invented). Make them want to see it.',
  oneAction: 'One concrete action: build the whole message around ONE physical first step and how it will feel.',
  friendly: 'A short friendly note: like a quick voice message from someone who knows them well. Simple, close, a little informal.',
};

/** Scenarios that fit each onboarding voice style. Unknown style: all. */
const STYLE_SCENARIOS = {
  'Warm, almost a whisper': ['support', 'anticipation', 'oneAction', 'friendly'],
  'Calm & confident': ['support', 'challenge', 'anticipation', 'oneAction', 'friendly'],
  'Like my best friend': ['support', 'humor', 'challenge', 'anticipation', 'oneAction', 'friendly'],
  'Gentle coach': ['support', 'challenge', 'anticipation', 'oneAction'],
  'Bright & smiling': ['humor', 'challenge', 'anticipation', 'oneAction', 'friendly'],
  'Wise & unhurried': ['support', 'anticipation', 'oneAction', 'friendly'],
};

/**
 * Openings stay familiar on purpose: varied openers ("Ever notice how…")
 * sounded forced. The body varies; the greeting is a known, warm voice.
 */
const OPENINGS = {
  goodMorning: 'Start with exactly "Good morning." (add the name after it only if it sounds natural).',
  itsMe: 'Start with exactly "Hey {name}, it\'s me."',
};

function pickOne(items, rand = Math.random) {
  return items[Math.floor(rand() * items.length)];
}

/** Prefer options not used recently; if everything was used, avoid only the last. */
function pickFresh(options, recentUsed, rand) {
  const used = recentUsed.filter(Boolean);
  const fresh = options.filter((o) => !used.includes(o));
  if (fresh.length) return pickOne(fresh, rand);
  const notLast = options.filter((o) => o !== used[0]);
  return pickOne(notLast.length ? notLast : options, rand);
}

function cleanList(values) {
  return Array.isArray(values)
    ? values.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
}

/** All onboarding topics, tagged with what kind of answer they are. */
function themeCandidates(answers) {
  const out = [];
  for (const v of cleanList(answers.futureSelf)) out.push({ kind: 'goal', value: v });
  for (const v of cleanList(answers.morningHabits || answers.alreadyProud)) {
    out.push({ kind: 'habit', value: v });
  }
  for (const v of cleanList(answers.hardMornings)) out.push({ kind: 'motivation', value: v });
  for (const v of cleanList(answers.morningFeelings)) out.push({ kind: 'feeling', value: v });
  return out;
}

const THEME_LABEL = {
  goal: 'a goal / who they are becoming',
  habit: 'a morning habit they want to keep',
  motivation: 'something that gets them out of bed',
  feeling: 'how they want to feel when they wake up',
};

/** Recent scripts from the app, newest first: [{ text, scenario?, theme?, opening? }]. */
function recentOf(answers) {
  const list = Array.isArray(answers.recentScripts) ? answers.recentScripts : [];
  return list
    .map((r) => (typeof r === 'string' ? { text: r } : r || {}))
    .map((r) => ({
      text: String(r.text || '').trim().slice(0, 600),
      scenario: r.scenario || null,
      theme: r.theme || null,
      opening: r.opening || null,
    }))
    .filter((r) => r.text)
    .slice(0, 10);
}

/**
 * Decide the plan for this script in code, so variety does not depend on
 * the model remembering to vary.
 */
function planScript(answers = {}, rand = Math.random) {
  const recent = recentOf(answers);
  const mood = `${answers.moodForTomorrow || ''} ${answers.moodNoteForTomorrow || ''}`;
  const crisis = looksLikeCrisis(mood);

  const allowed = crisis
    ? ['support']
    : STYLE_SCENARIOS[answers.voiceStyle] || Object.keys(SCENARIOS);
  // Never the same scenario twice in a row; prefer ones unused lately.
  const lastScenario = recent[0]?.scenario;
  const pool = allowed.filter((s) => s !== lastScenario);
  const scenario = pickFresh(
    pool.length ? pool : allowed,
    recent.slice(0, Math.max(1, allowed.length - 1)).map((r) => r.scenario),
    rand
  );

  const themes = themeCandidates(answers);
  const theme = themes.length
    ? (() => {
        const values = themes.map((t) => t.value);
        const value = pickFresh(values, recent.slice(0, Math.max(1, values.length - 1)).map((r) => r.theme), rand);
        return themes.find((t) => t.value === value);
      })()
    : null;

  // Alternate the two greetings; "Good morning" only makes sense before noon.
  const morning = answers.isMorning !== false;
  const last = recent[0]?.opening;
  const opening = !morning
    ? 'itsMe'
    : last === 'goodMorning'
      ? 'itsMe'
      : last === 'itsMe'
        ? 'goodMorning'
        : rand() < 0.5
          ? 'goodMorning'
          : 'itsMe';

  return { scenario, theme, opening, recent, crisis };
}

function buildScriptMessages(answers = {}, rand = Math.random) {
  const name = String(answers.name || '').trim().split(/\s+/)[0] || '';
  const plan = planScript(answers, rand);
  // The day in every script read as filler ("Thursday's here…"): offer it
  // only now and then.
  const weekday = answers.weekday && rand() < 0.3 ? answers.weekday : null;

  const system = `You write the spoken morning alarm for Future Self Alarm. The listener wakes up to their OWN cloned voice, so it must sound like a real person leaving a quick, warm voice message to themselves: natural, spontaneous, a little imperfect. Never a podcast host, a coach, a wellness app or an AI assistant.

How it must sound when spoken:
- Short sentences, each one a natural breath. Fragments are fine. Commas and full stops create the pauses, so use them.
- Second person, from "me" to "you". Warm and honest. Light urgency is fine, guilt and hustle are not.
- ${LENGTH.words} (${LENGTH.seconds}). Never more than ${LENGTH.max} words.

Variety (most important):
- You get the person's recent alarm scripts. After the greeting, do NOT reuse their key phrases, metaphors, images or structure. Swapping words for synonyms does NOT count as new: the idea and the shape must be different.
- Follow the given scenario, theme and opening exactly.
- Open exactly as the opening line says, then make everything after it new.
- Do not end with a motivational slogan or catchphrase. End on something specific to this message.

Content:
- Use ONLY the one theme you are given. Do not try to fit in all their habits and goals.
- Never invent facts about the person, their plans, people or events. You cannot see them: do not describe their room, bed, light, window, weather, objects or what they dreamed. Never add plans or things that are not in their answers (no walks, sketchbooks, meetings, trips).
- Everyday spoken words only, like texting a close friend. No poetic images, no wellness language, no exclamation marks.
- Mention the weekday only if it is given AND it adds something.
- Banned words and phrases: "you've got this", "best version of yourself", "future self", "lean into", "hold space", "journey", "manifest", "rise and shine", "seize the day", "new day", "embrace", "unfold", "magic", "tranquil", "savor", "cozy", "radiant", "vibrant", "take on the day", "let's get moving", "fresh start".

Rhythm reference (for pace and pauses ONLY, never copy its words or structure): "Hey. It's me. No rush. One slow breath, then sit up. Water first. Then we'll see."
- No emoji, no stage directions, no quotes around the script, no dashes of any kind (the text is also shown on screen). Plain spoken English, or the user's language if their answers are clearly not English.
- Return ONLY the spoken script.`;

  const recentBlock = plan.recent.length
    ? `Recent scripts (newest first). After the greeting, do not repeat their phrases, metaphors or structure:\n${plan.recent
        .map((r, i) => `${i + 1}. ${r.text}`)
        .join('\n')}`
    : 'Recent scripts: none yet.';

  const moodLine = answers.moodForTomorrow
    ? plan.crisis
      ? 'They had a very hard day. Be especially calm, soft and kind. Do not quote or name what they wrote. No urgency.'
      : `How they felt the day before, in their own words (let it shape the tone gently; never quote it back, never mention a "check-in"): ${answers.moodForTomorrow}${answers.moodNoteForTomorrow ? `; note: ${answers.moodNoteForTomorrow}` : ''}`
    : null;

  const user = [
    name ? `Their name: ${name} (use it at most once, or not at all)` : null,
    weekday ? `Day: ${weekday}` : null,
    `Voice style they chose: ${answers.voiceStyle || 'warm, natural, like a friend'}`,
    `Scenario: ${SCENARIOS[plan.scenario]}`,
    plan.theme
      ? `Theme (the only one to use): ${THEME_LABEL[plan.theme.kind]}: "${plan.theme.value}"`
      : 'Theme: simply getting up gently this morning.',
    `Opening: ${OPENINGS[plan.opening].replace('{name}', name || 'you')}`,
    moodLine,
    recentBlock,
    `Write the new script now. ${LENGTH.words}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system,
    user,
    length: LENGTH,
    meta: {
      scenario: plan.scenario,
      theme: plan.theme ? plan.theme.value : null,
      opening: plan.opening,
    },
  };
}

/** Phrases the model keeps sliding back to; a hit triggers one rewrite. */
const BANNED_RE = /you'?ve got this|best version|future self|lean into|hold space|journey|manifest|rise and shine|seize the day|new day|embrace|unfold|magic|tranquil|savou?r|cozy|radiant|vibrant|take on the day|let'?s get moving|fresh start|!/i;

module.exports = { buildScriptMessages, lengthGuide, planScript, SCENARIOS, BANNED_RE };

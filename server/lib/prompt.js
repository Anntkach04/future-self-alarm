const LENGTH_GUIDE = {
  'About 30 seconds': {
    label: 'About 30 seconds',
    words: '75 to 110 words',
    seconds: '20 to 30 seconds spoken, unhurried',
  },
  'Quick boost': {
    label: 'About 30 seconds',
    words: '75 to 110 words',
    seconds: '20 to 30 seconds spoken, unhurried',
  },
  'A few warm words': {
    label: 'About 30 seconds',
    words: '75 to 110 words',
    seconds: '20 to 30 seconds spoken, unhurried',
  },
  'Full morning letter': {
    label: 'About 30 seconds',
    words: '75 to 110 words',
    seconds: '20 to 30 seconds spoken, unhurried',
  },
};

const OPENING_ANGLES = [
  'soft greeting from across the room',
  'quiet pride in who they already are',
  'one small beautiful thing waiting today',
  'permission to move slowly',
  'remembering a goal as already true',
  'warm check-in like a best friend',
  'gentle nudge toward their morning ritual',
  'gratitude for yesterday’s effort',
];

function list(values) {
  if (!Array.isArray(values) || values.length === 0) return 'not specified';
  return values.filter(Boolean).join('; ');
}

function lengthGuide(messageLength) {
  return LENGTH_GUIDE[messageLength] || LENGTH_GUIDE['About 30 seconds'];
}

function pickAngle(answers = {}) {
  const seed = [
    answers.weekday,
    answers.name,
    ...(answers.futureSelf || []),
    ...(answers.morningHabits || answers.alreadyProud || []),
    String(Date.now()),
  ].join('|');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return OPENING_ANGLES[hash % OPENING_ANGLES.length];
}

function buildScriptMessages(answers = {}) {
  const name = String(answers.name || '').trim() || 'love';
  const length = lengthGuide(answers.messageLength);
  const weekday = answers.weekday || null;
  const angle = pickAngle(answers);

  const system = `You write spoken morning alarm scripts for Future Self Alarm.

The listener wakes to their OWN cloned voice speaking naturally — like a real person leaving a casual voice message. Warm, spontaneous, conversational. Subtle changes in pace, natural pauses, soft breaths implied by commas/periods, slight imperfections. Never polished, robotic, exaggerated, or like reading a script. Never like a podcast host, coach, wellness app, or AI assistant.

Voice of the script:
- First person to second person: "Hey ${name}", "it's me", "come on".
- Address them by name once near the start.
- Warm and honest. Short sentences. Fragments OK. Light urgency ("come on", "sit up") but NO guilt, hustle, affirmations-as-therapy, or "I'm so proud of you" pep-talk loops.
- Ban phrases that sound AI: "you've got this", "best version of yourself", "future self", "lean into", "hold space", "journey", "manifest", "soft morning light" as purple prose.
- Weave goals / pride / hard mornings as lived feelings, not a bullet list.
- Match the requested voice style.
- Aim for ${length.words} so it speaks for ${length.seconds}. Never under 70 words. Prefer about 85 to 100.
- EVERY script must feel different: new opening, new concrete detail, new closer.
- Today's creative angle: ${angle}.
- No emoji. No stage directions. No quotes around the whole script. Plain spoken English (or match the user's language if answers are clearly not English).
- Never use em or en dashes. Prefer commas or periods. A short hyphen is OK once ("heavy - go easy").
- Return ONLY the spoken script.`;

  const user = [
    `Name: ${name}`,
    weekday ? `Weekday: ${weekday}` : null,
    `Freshness token: ${Date.now()}`,
    `Creative angle: ${angle}`,
    `How they want to feel on waking: ${list(answers.morningFeelings)}`,
    `Main goals / who they are becoming: ${list(answers.futureSelf)}`,
    `Morning habits they want to keep: ${list(answers.morningHabits || answers.alreadyProud)}`,
    `Line they need on a hard morning: ${list(answers.hardMornings)}`,
    `Voice style: ${answers.voiceStyle || 'Casual voice message — warm, spontaneous, natural pauses'}`,
    answers.moodForTomorrow
      ? `How they felt YESTERDAY (shapes THIS wake only; do not mention “mood check-in”): ${answers.moodForTomorrow}${answers.moodNoteForTomorrow ? `; note: ${answers.moodNoteForTomorrow}` : ''}`
      : null,
    `Length: ${length.label}, ${length.words} (${length.seconds}).`,
    'Write a brand-new script now. Make it sound like them talking, not a template.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user, length };
}

module.exports = { buildScriptMessages, lengthGuide };

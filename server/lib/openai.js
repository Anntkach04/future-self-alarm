const { looksLikeCrisis, CRISIS_REPLY } = require('./moodSafety');
const fetch = require('node-fetch');
const { buildScriptMessages, lengthGuide, BANNED_RE } = require('./prompt');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MOOD_MODEL = process.env.OPENAI_MOOD_MODEL || 'gpt-4o-mini';
const MOOD_MAX_WORDS = 45;

function clampMoodAdvice(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^["']|["']$/g, '')
    // No dashes in the UI: a dash between words becomes a sentence break.
    // Hyphens inside words ("self-care") stay.
    .replace(/\s*[—–―]\s*/g, ' - ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`)
    .replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+/g)?.map((part) => part.trim()) ?? [cleaned];
  let short = sentences.slice(0, 3).join(' ').trim();
  const words = short.split(/\s+/).filter(Boolean);
  if (words.length > MOOD_MAX_WORDS) {
    short = `${words.slice(0, MOOD_MAX_WORDS).join(' ').replace(/[.,!?]+$/, '')}.`;
  }
  return short;
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || '';
}

async function generateMorningScriptOnce(answers, extraNote) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    const error = new Error(
      'Missing OPENAI_API_KEY. Add it to .env in the project root.'
    );
    error.status = 500;
    throw error;
  }

  const { system, user, meta } = buildScriptMessages(answers);
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 1.05,
      presence_penalty: 0.55,
      frequency_penalty: 0.45,
      max_tokens: 420,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: extraNote ? `${user}\n${extraNote}` : user },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || data?.message || 'OpenAI script failed';
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  const text = String(data?.choices?.[0]?.message?.content || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    // Script is shown on screen too: no dashes between words.
    .replace(/\s*[—–―]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s+/g, ' ');

  if (!text) {
    const error = new Error('OpenAI returned an empty script');
    error.status = 502;
    throw error;
  }

  return {
    text,
    model: data.model || MODEL,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    // What was planned, so the app can send it back and keep varying.
    ...meta,
  };
}

/** One rewrite if the model slipped into banned / template phrasing. */
async function generateMorningScript(answers) {
  const first = await generateMorningScriptOnce(answers);
  const words = first.wordCount;
  if (!BANNED_RE.test(first.text) && words <= lengthGuide(answers).max) return first;
  try {
    const second = await generateMorningScriptOnce(
      answers,
      'Your last draft used banned phrasing, an exclamation mark, or ran long. Write it again, plainer and within the word limit.'
    );
    return BANNED_RE.test(second.text) && !BANNED_RE.test(first.text) ? first : second;
  } catch {
    return first;
  }
}

async function generateMoodAdvice({ mood, note, name, goals = [], feelings = [] }) {
  // Free-text mood can carry a crisis: never answer it with a pep talk.
  if (looksLikeCrisis(`${mood} ${note}`)) {
    return { advice: CRISIS_REPLY, model: 'safety' };
  }
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    return {
      advice:
        'Thank you for telling me. You showed up for yourself today, and that counts. Sleep well, I will be there in the morning.',
    };
  }

  const about = [
    name ? `Name: ${name}` : '',
    goals.length ? `What they are working toward: ${goals.join('; ')}` : '',
    feelings.length ? `How they want mornings to feel: ${feelings.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Runs alongside the reply, so it adds no wait.
  const plansPromise = extractPlans({ mood, note, goals });

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MOOD_MODEL,
      temperature: 0.85,
      max_tokens: 90,
      messages: [
        {
          role: 'system',
          content: [
            "You are the user's Future Self: the same person, a little further down the road, talking to them tonight.",
            'Write 2 or 3 short sentences. Hard limit: 40 words total.',
            'Be specific to what they wrote and to what they are working toward. Never generic praise like "you are amazing" or "you will shine".',
            'Sentence 1: show you heard them, in fresh words (do not repeat their negative words back).',
            'Sentence 2: one concrete, encouraging truth about them or their goal.',
            'Optional sentence 3: what you will help with tomorrow morning when you wake them.',
            'Tone: warm, confident, on their side, like a close friend who believes in them. If it sounds painful, be gentle and steady rather than loud.',
            'Never therapize: no "give yourself grace", "being human", "take a deep breath", "it is okay to feel".',
            'Never use dashes of any kind; use periods and commas. No bullets, quotes, emoji, exclamation marks, or name at the start.',
            'Good: "Long day, and you still made room for it. Every morning you show up, the routine gets a little more yours. Tomorrow I will wake you gently and we start small."',
          ].join(' '),
        },
        {
          role: 'user',
          content: `${about ? `${about}\n` : ''}How they feel today, in their words: ${mood}${note ? `\nMore: ${note}` : ''}`,
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || data?.message || 'OpenAI advice failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const advice = clampMoodAdvice(
    String(data?.choices?.[0]?.message?.content || '')
  );

  if (!advice) {
    const error = new Error('OpenAI returned empty advice');
    error.status = 502;
    throw error;
  }

  const plans = await plansPromise;
  return { advice, model: data.model || MOOD_MODEL, ...plans };
}

/**
 * From a check-in, pull out (1) one thing to remind them of tomorrow morning
 * and (2) a new goal that is not on their list yet. Both optional. Best
 * effort: any failure just means no extras.
 */
async function extractPlans({ mood, note, goals = [] }) {
  const apiKey = getOpenAiKey();
  if (!apiKey) return { intention: null, newGoal: null };
  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MOOD_MODEL,
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Read what a person wrote about their day. Return JSON {"intention": string|null, "newGoal": string|null}.',
              'intention: one thing they clearly want to do or remember tomorrow (or soon), as a short phrase in their language starting with a verb, max 8 words, e.g. "finish the presentation", "go for a run before work". null if they did not state a plan.',
              'newGoal: a longer-term goal they clearly state that is NOT already in their goals list (same meaning counts as already there), as a short phrase starting with a verb, max 6 words, e.g. "start running", "learn Spanish". null otherwise. A one-day task is an intention, not a goal.',
              'Never invent. When unsure, use null.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Their goals: ${goals.length ? goals.join('; ') : '(none)'}\nThey wrote: ${mood}${note ? `\n${note}` : ''}`,
          },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) return { intention: null, newGoal: null };
    const parsed = JSON.parse(String(data?.choices?.[0]?.message?.content || '{}'));
    const clean = (v, max) =>
      typeof v === 'string' && v.trim() ? v.trim().replace(/[.!]+$/, '').slice(0, max) : null;
    return { intention: clean(parsed.intention, 80), newGoal: clean(parsed.newGoal, 60) };
  } catch {
    return { intention: null, newGoal: null };
  }
}

/**
 * Text of a short voice note (the person talking to tomorrow-them).
 * Returns '' when it can't be understood; throws only on missing key.
 */
async function transcribeAudio(buffer, mimeType = 'audio/m4a') {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    const error = new Error('Missing OPENAI_API_KEY');
    error.status = 500;
    throw error;
  }
  const ext = /webm/.test(mimeType) ? 'webm' : /wav/.test(mimeType) ? 'wav' : /mpeg|mp3/.test(mimeType) ? 'mp3' : 'm4a';
  for (const model of ['gpt-4o-mini-transcribe', 'whisper-1']) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `note.${ext}`);
    form.append('model', model);
    // Node's own fetch: node-fetch (used above) can't send a standard FormData.
    const response = await globalThis.fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (response.ok) {
      const data = await response.json();
      return String(data?.text || '').trim().slice(0, 400);
    }
    console.warn('[transcribe]', model, response.status);
  }
  return '';
}

module.exports = { generateMorningScript, generateMoodAdvice, getOpenAiKey, transcribeAudio };

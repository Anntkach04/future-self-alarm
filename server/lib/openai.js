const fetch = require('node-fetch');
const { buildScriptMessages } = require('./prompt');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MOOD_MODEL = process.env.OPENAI_MOOD_MODEL || 'gpt-4o-mini';
const MOOD_MAX_WORDS = 32;

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

async function generateMorningScript(answers) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    const error = new Error(
      'Missing OPENAI_API_KEY. Add it to .env in the project root.'
    );
    error.status = 500;
    throw error;
  }

  const { system, user } = buildScriptMessages(answers);
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
        { role: 'user', content: user },
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
  };
}

async function generateMoodAdvice({ mood, note, name }) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    return {
      advice:
        "That’s not the real you. You’re strong, capable, and already winning. Rest up; tomorrow you’re going to crush it.",
    };
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MOOD_MODEL,
      temperature: 0.85,
      max_tokens: 55,
      messages: [
        {
          role: 'system',
          content: [
            'You are the user\'s Future Self, their hype person, not their therapist.',
            'Write EXACTLY 2 short sentences. Hard limit: 30 words total.',
            'Tone: pep talk, warm, confident, energetic, loving. Pump them up.',
            'Tell them they\'re strong, capable, amazing, already winning.',
            'Point to tomorrow as a fresh start where they will crush it.',
            'NEVER repeat or echo their negative words (no "bad person", "heavy", "mistakes", "imperfect").',
            'NEVER therapize: no "I know it\'s hard", "give yourself grace", "being human", "take a deep breath", "act of kindness".',
            'NEVER analyze feelings. Just hype them up like a best friend before bed.',
            'Never use dashes of any kind; use periods and commas. Example: "That\'s not you. You\'re powerful and you\'ve got this. Sleep, reset, tomorrow you\'re going to kill it."',
            'Bad: "I know it feels overwhelming and being human means being imperfect..."',
            'No bullets, quotes, emoji, or name at the start.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Mood: ${mood}\nThey wrote: ${note || '(nothing)'}`,
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

  return { advice, model: data.model || MOOD_MODEL };
}

module.exports = { generateMorningScript, generateMoodAdvice, getOpenAiKey };

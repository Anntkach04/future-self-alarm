const fetch = require('node-fetch');
const { buildScriptMessages } = require('./prompt');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

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
      temperature: 0.8,
      max_tokens: 500,
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
    .replace(/^["']|["']$/g, '');

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
        "That's allowed. You don't have to sort the whole day tonight. Tomorrow, start with one small thing — I'll be there when you wake.",
    };
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 180,
      messages: [
        {
          role: 'system',
          content:
            "You are the user's Future Self. Speak in first person as them, briefly, like a calm note to tonight. 2–4 short sentences. Warm, specific, not clinical, not a therapist, no quotes, no bullets, no emoji. Acknowledge the feeling and offer one small next step.",
        },
        {
          role: 'user',
          content: `Name: ${name || 'friend'}\nMood: ${mood}\nThey wrote: ${note || '(nothing more)'}`,
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

  const advice = String(data?.choices?.[0]?.message?.content || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!advice) {
    const error = new Error('OpenAI returned empty advice');
    error.status = 502;
    throw error;
  }

  return { advice, model: data.model || MODEL };
}

module.exports = { generateMorningScript, generateMoodAdvice, getOpenAiKey };

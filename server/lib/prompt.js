const LENGTH_GUIDE = {
  'About 30 seconds': {
    label: 'About 30 seconds',
    words: '90 to 140 words',
    seconds: 'about 30 seconds spoken, unhurried',
  },
  'Quick boost': {
    label: 'About 30 seconds',
    words: '90 to 140 words',
    seconds: 'about 30 seconds spoken, unhurried',
  },
  'A few warm words': {
    label: 'About 30 seconds',
    words: '90 to 140 words',
    seconds: 'about 30 seconds spoken, unhurried',
  },
  'Full morning letter': {
    label: 'About 30 seconds',
    words: '90 to 140 words',
    seconds: 'about 30 seconds spoken, unhurried',
  },
};

function list(values) {
  if (!Array.isArray(values) || values.length === 0) return 'not specified';
  return values.filter(Boolean).join('; ');
}

function lengthGuide(messageLength) {
  return LENGTH_GUIDE[messageLength] || LENGTH_GUIDE['About 30 seconds'];
}

function buildScriptMessages(answers = {}) {
  const name = String(answers.name || '').trim() || 'love';
  const length = lengthGuide(answers.messageLength);
  const weekday = answers.weekday || null;

  const system = `You write spoken morning alarm scripts for Future Self Alarm.

The listener wakes up to their own cloned voice. This audio IS the alarm — it must feel like a warm hand on the shoulder, never a ringtone, coach, or to-do list.

Voice of the script:
- First person, present tense, already-true. "I am", "this is already mine", "I keep my word".
- Address them by name at least once near the start.
- Only nourishment. No fear, guilt, hustle, "don't snooze", "get up", "you should".
- If a hard-morning line is provided, weave it in as comfort, not as a problem to solve.
- Identity, goals, and pride chips become lived facts, not a checklist.
- Match the requested voice style.
- Sound like a private letter read aloud, slightly slow, with short sentences that still make a full letter — not a one-liner.
- Stay inside ${length.words} (${length.seconds}). Prefer the longer end of the range.
- English unless the answers are clearly in another language — then match that language.
- Return ONLY the spoken script. No title, quotes, stage directions, or emoji.`;

  const user = [
    `Name: ${name}`,
    weekday ? `Weekday: ${weekday}` : null,
    `How they want to feel on waking: ${list(answers.morningFeelings)}`,
    `Main goals / who they are becoming: ${list(answers.futureSelf)}`,
    `What they are already proud of: ${list(answers.alreadyProud)}`,
    `Line they need on a hard morning: ${list(answers.hardMornings)}`,
    `Voice style: ${answers.voiceStyle || 'Warm, almost a whisper'}`,
    `Length: ${length.label} — ${length.words} (${length.seconds}). Write toward the longer end.`,
    'Write the script now.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user, length };
}

module.exports = { buildScriptMessages, lengthGuide };

const LENGTH_GUIDE = {
  'Quick boost': {
    label: 'Quick boost',
    words: '40 to 55 words',
    seconds: 'about 20 seconds spoken',
  },
  'A few warm words': {
    label: 'A few warm words',
    words: '80 to 110 words',
    seconds: 'about 40 seconds spoken',
  },
  'Full morning letter': {
    label: 'Full morning letter',
    words: '160 to 220 words',
    seconds: '60 to 90 seconds spoken',
  },
};

function list(values) {
  if (!Array.isArray(values) || values.length === 0) return 'not specified';
  return values.filter(Boolean).join('; ');
}

function lengthGuide(messageLength) {
  return (
    LENGTH_GUIDE[messageLength] || LENGTH_GUIDE['A few warm words']
  );
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
- Identity and pride chips become lived facts, not goals.
- Match the requested voice style.
- Sound like a private letter read aloud, slightly slow, with short sentences that breathe.
- English unless the answers are clearly in another language — then match that language.
- Return ONLY the spoken script. No title, quotes, stage directions, or emoji.`;

  const user = [
    `Name: ${name}`,
    weekday ? `Weekday: ${weekday}` : null,
    `How they want to feel on waking: ${list(answers.morningFeelings)}`,
    `Who their Future Self is: ${list(answers.futureSelf)}`,
    `What Future Self already celebrates: ${list(answers.alreadyProud)}`,
    `Line they need on a hard morning: ${list(answers.hardMornings)}`,
    `Voice style: ${answers.voiceStyle || 'Warm, almost a whisper'}`,
    `Length: ${length.label} — ${length.words} (${length.seconds}). Stay inside this range.`,
    'Write the script now.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user, length };
}

module.exports = { buildScriptMessages, lengthGuide };

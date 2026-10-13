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
    ...(answers.alreadyProud || []),
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

The listener wakes to their OWN cloned voice. Write like a real person talking to themselves in bed: natural, intimate, slightly imperfect. Never like a podcast host, coach, or AI assistant.

Voice of the script:
- First person to second person: "Hey ${name}…", "it's me", "I need you up with me".
- Address them by name once near the start.
- Warm and honest. Light urgency is OK ("come on", "get up with me") but NO guilt, hustle porn, or shame.
- Weave goals / pride / hard-morning needs as lived feelings, not a bullet list.
- Match the requested voice style.
- Aim for ${length.words} so it speaks for ${length.seconds}. Never under 70 words. Prefer about 90 to 100.
- EVERY script must feel different: new opening, new image, new closer. Do not reuse stock lines like "from your future" every time unless it fits naturally once.
- Today's creative angle: ${angle}.
- No emoji. No stage directions. No quotes around the whole script. Plain spoken English (or match the user's language if answers are clearly not English).
- Never use em or en dashes. Prefer commas or periods. Only if yesterday's mood shapes a short aside, you may use a short hyphen like "heavy - so start soft".
- Return ONLY the spoken script.`;

  const user = [
    `Name: ${name}`,
    weekday ? `Weekday: ${weekday}` : null,
    `Freshness token: ${Date.now()}`,
    `Creative angle: ${angle}`,
    `How they want to feel on waking: ${list(answers.morningFeelings)}`,
    `Main goals / who they are becoming: ${list(answers.futureSelf)}`,
    `What they are already proud of: ${list(answers.alreadyProud)}`,
    `Line they need on a hard morning: ${list(answers.hardMornings)}`,
    `Voice style: ${answers.voiceStyle || 'Warm, almost a whisper'}`,
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

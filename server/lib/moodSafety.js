/** Keep in sync with src/services/moodSafety.ts. */
const CRISIS = [
  /\b(kill|hurt|harm|cut)\s+(my ?self|myself)\b/i,
  /\bsuicid/i,
  /\bend (it all|my life)\b/i,
  /\b(want|wanna|going) to die\b/i,
  /\bdon'?t want to (live|be alive|wake up)\b/i,
  /\bno reason to live\b/i,
  /\bself[- ]?harm/i,
  /суїцид|самогубств|покінчити з собою|не хочу жити|хочу померти|вбити себе|завдати собі шкоди/i,
  /суицид|покончить с собой|не хочу жить|хочу умереть|убить себя/i,
];

function looksLikeCrisis(text) {
  return CRISIS.some((re) => re.test(String(text || '')));
}

const CRISIS_REPLY =
  "I'm really glad you told me. You don't have to carry this alone. " +
  'If you might hurt yourself, please call your local emergency number now, ' +
  'or in the US call or text 988.';

module.exports = { looksLikeCrisis, CRISIS_REPLY };

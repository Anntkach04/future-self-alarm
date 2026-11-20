/**
 * Free-text mood can carry a crisis. Never answer that with a pep talk:
 * reply with care and point to real help instead. Kept in sync with
 * server/lib/moodSafety.js (the server checks too).
 */
const CRISIS = [
  /\b(kill|hurt|harm|cut)\s+(my ?self|myself)\b/i,
  /\bsuicid/i,
  /\bend (it all|my life)\b/i,
  /\b(want|wanna|going) to die\b/i,
  /\bdon'?t want to (live|be alive|wake up)\b/i,
  /\bno reason to live\b/i,
  /\bself[- ]?harm/i,
  // Ukrainian / Russian
  /суїцид|самогубств|покінчити з собою|не хочу жити|хочу померти|вбити себе|завдати собі шкоди/i,
  /суицид|покончить с собой|не хочу жить|хочу умереть|убить себя/i,
];

export function looksLikeCrisis(text: string) {
  return CRISIS.some((re) => re.test(text));
}

export const CRISIS_REPLY =
  "I'm really glad you told me. You don't have to carry this alone. " +
  'If you might hurt yourself, please call your local emergency number now, ' +
  'or in the US call or text 988.';

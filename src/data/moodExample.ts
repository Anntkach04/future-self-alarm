/**
 * The example under "How are you feeling today?": short, in the person's
 * own terms (their goals, what gets them up, how they want mornings to
 * feel), and a different one each day.
 */

type ExampleInput = {
  futureSelf: string[];
  hardMornings: string[];
  morningFeelings: string[];
};

/** "Build a morning routine" → "build a morning routine"; "Calm & grounded" → "calm and grounded". */
function phrase(value: string | undefined) {
  if (!value) return '';
  const v = value.trim().replace(/\s*&\s*/g, ' and ').replace(/[.!?]+$/, '');
  if (!v) return '';
  // Keep "I" and proper words as typed; only soften the first letter.
  return /^I\b/.test(v) ? v : v.charAt(0).toLowerCase() + v.slice(1);
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

function pick<T>(list: T[], seed: number) {
  return list.length ? list[seed % list.length] : undefined;
}

export function dailyMoodExample(input: ExampleInput, date = new Date()) {
  const day = dayOfYear(date);
  const goal = phrase(pick(input.futureSelf, day));
  const lift = phrase(pick(input.hardMornings, day + 1));
  const feel = phrase(pick(input.morningFeelings, day + 2));

  const templates: (string | null)[] = [
    goal ? `A bit tired, but still proud I'm trying to ${goal}.` : null,
    feel ? `Busy day, head is full. Tomorrow I want to wake up feeling ${feel}.` : null,
    lift ? `Calm tonight. ${lift.charAt(0).toUpperCase() + lift.slice(1)} really helped today.` : null,
    lift ? `Stressed about tomorrow, but I know ${lift} will get me going.` : null,
    feel ? `Good day! I want tomorrow to start ${feel} too.` : null,
    goal ? `Low energy, but I didn't give up on wanting to ${goal}.` : null,
    goal ? `Honestly a little lost today. I need a reminder why I want to ${goal}.` : null,
  ];
  const usable = templates.filter((t): t is string => Boolean(t));
  const fallback = [
    'Tired, but hopeful. Today was long and I want a softer morning.',
    'Pretty good, actually. I want to keep this feeling going tomorrow.',
    'A bit overwhelmed. I need tomorrow to start slow and clear.',
  ];
  return pick(usable.length ? usable : fallback, day) as string;
}

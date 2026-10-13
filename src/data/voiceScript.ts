/**
 * Short lines for Instant Voice Clone karaoke.
 * Comfortable to speak; wraps cleanly on phone screens.
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'friend';
  return [
    `Hey, it's ${who}.`,
    `It's morning, and I'm still waking up.`,
    `Give me a second.`,
    `I think I'll make breakfast first.`,
    `Then figure out what needs to get done today.`,
    `Actually, I should probably check the time.`,
    `Okay, that's fine.`,
    `Some mornings I know exactly what I'm doing.`,
    `Other mornings I just make it up as I go.`,
    `Yesterday was pretty busy.`,
    `I had a few things planned.`,
    `But half of them changed at the last minute.`,
    `That's usually how it goes.`,
    `Oh, wait.`,
    `I just remembered something I wanted to do later.`,
    `Maybe I'll go for a walk.`,
    `Get a coffee.`,
    `Or stop by that little shop near the station.`,
    `I wonder if it's open on Sundays.`,
    `Anyway, where was I?`,
    `Right. I was talking about today.`,
    `It's funny how I can remember a random conversation`,
    `from three years ago,`,
    `but forget why I walked into the kitchen.`,
    `A yellow bicycle.`,
    `Fresh orange juice.`,
    `Seven silver rings.`,
    `A blue jacket.`,
    `And a quiet street after the rain.`,
    `Those are just random words, by the way.`,
    `Alright, I think that's enough for now.`,
    `I'll probably remember something else in five minutes.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone ~20 cm away',
  'Talk like you’re half-awake, not like a narrator',
  'Same accent and pace as a normal morning',
  'About two minutes makes a much stronger clone',
];

export const MIN_RECORDING_SECONDS = 75;
export const TARGET_RECORDING_SECONDS = 120;

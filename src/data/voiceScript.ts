/**
 * Clone sample — ~60–75 sec at a calm pace (short enough to always upload).
 * Plain, easy to read. Chunks: ~1–2 lines at ~30pt.
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'friend';
  return [
    `Hello, my name is ${who}.`,
    `I am recording my voice in a quiet room.`,
    `I am speaking clearly, at a calm and natural pace.`,
    `The phone is about twenty centimeters away.`,
    `In the morning I wake up and drink a glass of water.`,
    `Then I make coffee and sit for a few minutes.`,
    `Outside, cars pass by, and people walk to work.`,
    `I check the weather, then I choose a jacket.`,
    `My keys are on the table next to my bag.`,
    `I will answer a few messages before I leave.`,
    `There is a small store on the corner with fruit.`,
    `I might buy oranges and a bottle of water.`,
    `In the afternoon I finish the most important task first.`,
    `If I feel stuck, I stand up, stretch, and continue.`,
    `In the evening I cook a simple meal at home.`,
    `Later I read for a while, then I go to sleep.`,
    `Thank you for listening. This is ${who}, and I am finished.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone ~20 cm away',
  'Speak clearly at a calm, natural pace',
  'Same accent as you use every day',
  'About one minute is enough for a strong clone',
];

export const MIN_RECORDING_SECONDS = 45;
export const TARGET_RECORDING_SECONDS = 75;

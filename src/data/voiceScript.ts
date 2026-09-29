/**
 * Read this the way you’d talk to yourself at 7am.
 * Same energy as the wake script → clone learns YOUR morning voice, not “narrator mode”.
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    `Hey. It's ${who}. This is just me — morning voice, a little soft, a little sleepy.`,
    `I'm not performing. This is how I actually talk when I wake up.`,
    `One slow breath. Then sit up. Today can start small.`,
    `I'm proud of you. Come on — let's begin. This is only my voice.`,
    // Light phoneme spice for on-screen word matching (say it naturally, don't "announce").
    `Yellow lilies, warm tea, seven bright stars.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone close (~20 cm)',
  'Talk to yourself — don’t “read out loud”',
  'Same accent and pace as a normal morning',
  'About a minute helps the clone lock onto you',
];

export const MIN_RECORDING_SECONDS = 30;
export const TARGET_RECORDING_SECONDS = 55;

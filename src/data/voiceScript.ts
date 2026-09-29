/**
 * Hybrid IVC script: natural morning talk (likeness) + light phoneme spice (STT).
 * Aim ~50–70s spoken so the server can split into multi-clip Instant Clone.
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    `Hey. It's ${who}. This is just me — morning voice, a little soft, a little sleepy.`,
    `I'm not performing. This is how I actually talk when I wake up. Close to the phone, natural pace.`,
    `One slow breath. Then sit up when you're ready. Today can start small — one clear step.`,
    `I'm proud of you for getting up. Really. Come on, let's begin. This is only my voice.`,
    `Yellow lilies, warm tea, seven bright stars at dawn.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone ~20 cm away',
  'Talk to yourself — don’t “read like a narrator”',
  'Same accent and pace as a normal morning',
  'About a minute gives a stronger clone (still Instant, not pro training)',
];

export const MIN_RECORDING_SECONDS = 35;
export const TARGET_RECORDING_SECONDS = 60;

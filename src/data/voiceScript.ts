/**
 * What the user reads while cloning.
 * Must sound like real morning talk — pangrams / counting train a “robot reader” IVC.
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    `Hey… it’s ${who}. This is just me, talking the way I actually talk in the morning.`,
    `Soft voice. A little sleepy. No performance — just close and real.`,
    `Take one slow breath with me. Then we’ll sit up when we’re ready.`,
    `Today can start small. One clear step. I’m proud of you for getting up.`,
    `I’ve got you. Come on… let’s begin.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone ~20 cm from your mouth',
  'Speak like you’re gently waking yourself — not reading a script',
  'Same pace and accent you’d use with a close friend',
  'A longer take (about a minute) makes the clone much more alive',
];

export const MIN_RECORDING_SECONDS = 30;
export const TARGET_RECORDING_SECONDS = 55;

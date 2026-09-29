/**
 * Clone sample script.
 * - Natural morning lines → better Instant Voice Clone (sounds like you, not a reader)
 * - A couple of phonetic lines → helps on-screen word highlight (STT) catch variety
 */
export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    `Hey… it's ${who}. This is my natural morning voice — calm, clear, and close.`,
    `I speak the way I talk when I wake up. Soft. No rush. No performance.`,
    `Take one slow breath. Then sit up when you're ready. Today can start small.`,
    // Phoneme coverage for the live word-matcher (not for “robot reading”).
    `Yellow lilies, red berries, warm tea. Seven bright stars glow at dawn.`,
    `Hey… wake up gently. You can do this. This is only my voice.`,
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Quiet room, phone ~20 cm from your mouth',
  'Speak like you’re gently waking yourself — not performing',
  'Same pace and accent you’d use with a close friend',
  'About a minute of clean speech makes a better clone',
];

export const MIN_RECORDING_SECONDS = 25;
export const TARGET_RECORDING_SECONDS = 50;

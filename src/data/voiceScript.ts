export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    `Hi, I'm ${who}.`,
    'The quick brown fox jumps over the lazy dog.',
    'Please bring yellow lilies, red berries, and warm tea.',
    'She sells sea shells by the south sea shore.',
    'One, two, three, four, five.',
    'Six, seven, eight, nine, ten.',
    'Blue, gold, green. Soft, clear, calm.',
    'Good morning. This is only my voice.',
  ];
}

export function buildVoiceScript(name: string) {
  return buildVoiceScriptLines(name).join(' ');
}

export const VOICE_TIPS = [
  'Find a quiet room',
  'Hold the phone ~20 cm from your mouth',
  'Speak in a calm, unhurried voice',
  'Sound like you’re gently waking yourself',
];

export const MIN_RECORDING_SECONDS = 20;
export const TARGET_RECORDING_SECONDS = 45;

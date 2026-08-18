export function buildVoiceScriptLines(name: string) {
  const who = name.trim() || 'there';
  return [
    'Hi.',
    `My name is ${who}.`,
    "I'm recording my voice so I can wake up to myself in the morning.",
    'Calm, clear, and real.',
    'Some days I want to stay in bed a little longer.',
    'But I know small steps build a bigger life.',
    'Today I choose focus, discipline, and kindness to myself.',
    'One, two, three, four, five.',
    'Six, seven, eight, nine, ten.',
    'Good morning.',
    'Get up.',
    "It's time to do what you promised yourself.",
    "You've got this.",
    'Start now.',
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

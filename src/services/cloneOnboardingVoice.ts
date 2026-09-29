import { TEMP_ELEVENLABS_TTS_ONLY } from '../config/devBypass';
import { buildAlarmScript } from '../data/alarmScript';
import { savePreviewAudio } from './audioPreview';
import {
  checkVoiceApiHealth,
  cloneVoiceFromUri,
  DEMO_VOICE,
  synthesizeSpeech,
  type VoiceApiHealth,
} from './elevenlabs';
import type { OnboardingAnswers } from '../context/OnboardingContext';

/** TEMPORARY — premade ElevenLabs voices while Instant Voice Cloning is unavailable. */
const TEMP_PREMADE_VOICE_IDS = [
  DEMO_VOICE.id,
  'EXAVITQu4vr4xnSDxMaL',
  'ErXwobaYiN019PkySvjV',
  'MF3mGyEYCl7XYWbV9V6O',
  'TxGEqnHWrfWFTfGW9XjX',
  'pNInz6obpgDQGcFmaJgB',
];

function pickTempVoiceId() {
  const index = Math.floor(Math.random() * TEMP_PREMADE_VOICE_IDS.length);
  return TEMP_PREMADE_VOICE_IDS[index] ?? DEMO_VOICE.id;
}

type CloneResult = {
  voiceId: string;
  previewPath: string;
  previewText: string;
  isDemo: boolean;
};

async function previewWithPremadeVoice(
  voiceId: string,
  answers: OnboardingAnswers
): Promise<Omit<CloneResult, 'voiceId'>> {
  const text = buildAlarmScript(answers.name);
  const tts = await synthesizeSpeech({ voiceId, text });
  const previewPath = await savePreviewAudio(tts.base64);
  return { previewPath, previewText: text, isDemo: true };
}

export async function cloneOnboardingVoice(params: {
  sampleUri?: string | null;
  answers: OnboardingAnswers;
}): Promise<CloneResult> {
  const health: VoiceApiHealth = await checkVoiceApiHealth();
  if (!health.hasKey && !health.elevenLabs) {
    throw new Error(
      'Voice server is offline. On the Mac run npm run server in the project folder.'
    );
  }

  // TEMPORARY — skip Instant Voice Cloning; TTS only with a premade EL voice.
  if (TEMP_ELEVENLABS_TTS_ONLY) {
    const voiceId = pickTempVoiceId();
    const preview = await previewWithPremadeVoice(voiceId, params.answers);
    return { voiceId, ...preview };
  }

  if (!params.sampleUri) {
    throw new Error('No recording found. Go back and record again.');
  }

  const clone = await cloneVoiceFromUri({
    uri: params.sampleUri,
    name: params.answers.name || 'User',
    mimeType: params.sampleUri.includes('.webm') ? 'audio/webm' : 'audio/m4a',
    fileName: params.sampleUri.includes('.webm') ? 'sample.webm' : 'sample.m4a',
  });

  // Always speak the fixed wake script (AI scripts optional later via USE_AI_ALARM_SCRIPTS).
  const text = buildAlarmScript(params.answers.name);
  if (health.openai === true || health.elevenLabs) {
    const { generateMorningAlarm } = await import('./elevenlabs');
    const alarm = await generateMorningAlarm({
      voiceId: clone.voiceId,
      answers: params.answers,
      text,
    });
    const previewPath = await savePreviewAudio(alarm.base64);
    return {
      voiceId: clone.voiceId,
      previewPath,
      previewText: alarm.text || text,
      isDemo: false,
    };
  }

  const tts = await synthesizeSpeech({ voiceId: clone.voiceId, text });
  const previewPath = await savePreviewAudio(tts.base64);
  return {
    voiceId: clone.voiceId,
    previewPath,
    previewText: text,
    isDemo: false,
  };
}

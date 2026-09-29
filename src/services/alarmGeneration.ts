import type { OnboardingAnswers } from '../context/OnboardingContext';
import { saveAlarmAudio } from './audioPreview';
import {
  buildPreviewLine,
  generateMorningAlarm,
  synthesizeSpeech,
} from './elevenlabs';

export async function buildAlarmAudioForId(params: {
  alarmId: string;
  voiceId: string;
  answers: OnboardingAnswers;
  useOpenAi: boolean;
}) {
  const { alarmId, voiceId, answers, useOpenAi } = params;

  if (useOpenAi) {
    const alarm = await generateMorningAlarm({ voiceId, answers });
    const uri = await saveAlarmAudio(alarm.base64, alarmId);
    return { uri, text: alarm.text };
  }

  const text = buildPreviewLine(answers.name);
  const tts = await synthesizeSpeech({ voiceId, text });
  const uri = await saveAlarmAudio(tts.base64, alarmId);
  return { uri, text };
}

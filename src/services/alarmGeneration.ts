import { Platform } from 'react-native';
import type { OnboardingAnswers } from '../context/OnboardingContext';
import { buildAlarmScript } from '../data/alarmScript';
import { installAlarmSystemSound } from './alarmSoundFile';
import { saveAlarmAudio } from './audioPreview';
import { generateMorningAlarm } from './elevenlabs';

export async function buildAlarmAudioForId(params: {
  alarmId: string;
  voiceId: string;
  answers: OnboardingAnswers;
}) {
  const { alarmId, voiceId, answers } = params;
  const fixedText = buildAlarmScript(answers.name);
  const generated = await generateMorningAlarm({
    voiceId,
    answers,
    text: fixedText,
  });
  const uri = await saveAlarmAudio(generated.base64, alarmId);
  const text = generated.text || fixedText;

  let systemSound: Awaited<ReturnType<typeof installAlarmSystemSound>> | null =
    null;
  try {
    systemSound = await installAlarmSystemSound({ alarmId, mp3Uri: uri });
  } catch (error) {
    // On iOS, without CAF the phone only plays a generic alarm tone.
    if (Platform.OS === 'ios') {
      throw error instanceof Error
        ? error
        : new Error('Could not build wake voice sound');
    }
    console.warn('System wake sound failed', error);
  }

  return { uri, text, systemSound };
}

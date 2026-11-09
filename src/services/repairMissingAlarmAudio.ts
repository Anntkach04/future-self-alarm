import * as FileSystem from 'expo-file-system/legacy';
import type { Alarm } from '../context/AlarmsContext';
import type { OnboardingAnswers } from '../context/OnboardingContext';
import { buildAlarmAudioForId } from './alarmGeneration';
import { scheduleAlarmNotifications } from './alarmScheduler';
import { alarmAudioExists } from './audioPreview';

/**
 * After schema migrations wipe audioUri/CAF (mix changes), or a native
 * reinstall leaves dead file paths, rebuild wake audio without forcing
 * the user through Create Alarm → Done again.
 *
 * voiceId is never cleared by those migrations — only local audio files.
 */
export async function repairMissingAlarmAudio(params: {
  alarms: Alarm[];
  voiceId: string;
  answers: OnboardingAnswers;
  mood?: { label: string; note?: string } | null;
  voiceLevel?: number;
  bedLevel?: number;
  paused?: boolean;
  updateAlarm: (id: string, patch: Partial<Alarm>) => void;
}): Promise<{ repaired: number; failed: number }> {
  const {
    alarms,
    voiceId,
    answers,
    mood,
    voiceLevel,
    bedLevel,
    paused,
    updateAlarm,
  } = params;

  let repaired = 0;
  let failed = 0;

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    const uriOk =
      Boolean(alarm.audioUri) && (await fileStillExists(alarm.audioUri));
    const mp3Ok = await alarmAudioExists(alarm.id);
    if (uriOk && mp3Ok) continue;

    try {
      const { uri, text } = await buildAlarmAudioForId({
        alarmId: alarm.id,
        voiceId,
        answers,
        mood: mood ?? null,
        voiceLevel,
        bedLevel,
      });
      updateAlarm(alarm.id, { audioUri: uri, scriptText: text });
      if (!paused) {
        await scheduleAlarmNotifications(
          { ...alarm, audioUri: uri, scriptText: text },
          uri
        );
      }
      repaired += 1;
    } catch (error) {
      failed += 1;
      console.warn('Alarm audio repair failed', alarm.id, error);
    }
  }

  return { repaired, failed };
}

async function fileStillExists(uri: string | null | undefined) {
  if (!uri || uri.startsWith('blob:')) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

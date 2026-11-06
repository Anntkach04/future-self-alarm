import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alarm } from '../context/AlarmsContext';
import type { OnboardingAnswers } from '../context/OnboardingContext';
import { buildAlarmAudioForId } from './alarmGeneration';
import { scheduleAlarmNotifications } from './alarmScheduler';

const LAST_REGEN_KEY = 'fsa.evening_regen.date';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Rebuild the next enabled alarm with a fresh personal script:
 * - right after today's mood is saved or changed (shapes the next wake), and
 * - once a day otherwise, so the wake message is never the same twice.
 */
export async function maybeEveningRegen(params: {
  alarms: Alarm[];
  voiceId: string | null;
  answers: OnboardingAnswers;
  mood: { label: string; note?: string } | null;
  voiceLevel?: number;
  bedLevel?: number;
  paused?: boolean;
  updateAlarm: (id: string, patch: Partial<Alarm>) => void;
}) {
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
  if (paused || !voiceId) return;

  // Same day + same mood → already fresh.
  const key = `${todayKey()}|${mood ? `${mood.label}|${mood.note ?? ''}` : ''}`;
  const last = await AsyncStorage.getItem(LAST_REGEN_KEY).catch(() => null);
  if (last === key) return;

  // The alarm that rings next from now (not the earliest clock time).
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const minutesUntil = (a: Alarm) =>
    (a.hour * 60 + a.minute - nowMin + 1440) % 1440;
  const next = alarms
    .filter((a) => a.enabled)
    .sort((a, b) => minutesUntil(a) - minutesUntil(b))[0];
  if (!next) return;
  // Don't swap the audio of an alarm that is about to ring.
  if (minutesUntil(next) < 10) return;

  try {
    const { uri, text } = await buildAlarmAudioForId({
      alarmId: next.id,
      voiceId,
      answers,
      mood,
      voiceLevel,
      bedLevel,
    });
    updateAlarm(next.id, { audioUri: uri, scriptText: text });
    await scheduleAlarmNotifications(
      { ...next, audioUri: uri, scriptText: text },
      uri
    );
    await AsyncStorage.setItem(LAST_REGEN_KEY, key);
  } catch (error) {
    console.warn('Evening regen failed', error);
  }
}

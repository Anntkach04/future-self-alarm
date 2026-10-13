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
 * After 21:00 local, rebuild the next enabled alarm with today’s mood
 * so tomorrow’s wake is shaped once — not forever.
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
  if (paused || !voiceId || !mood) return;
  const hour = new Date().getHours();
  if (hour < 21) return;

  const key = todayKey();
  const last = await AsyncStorage.getItem(LAST_REGEN_KEY).catch(() => null);
  if (last === key) return;

  const next = alarms
    .filter((a) => a.enabled)
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))[0];
  if (!next) return;

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

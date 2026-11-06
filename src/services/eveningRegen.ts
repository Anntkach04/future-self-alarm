import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alarm } from '../context/AlarmsContext';
import type { OnboardingAnswers } from '../context/OnboardingContext';
import { buildAlarmAudioForId } from './alarmGeneration';
import { nextAlarmOccurrences, scheduleAlarmNotifications } from './alarmScheduler';

/**
 * Fresh wake message for every ring, built once — close to the ring, not on
 * every mood tap:
 * - The "prepare window" opens PREPARE_WINDOW_HOURS before the next ring.
 *   The first time the app is open inside it, that ring gets a new script.
 *   Earlier in the day nothing is generated, so the user can still log moods.
 * - If today's mood changes after that build, one more rebuild is allowed
 *   (MAX_BUILDS_PER_RING), so a late check-in still counts without paying for
 *   audio on every tap.
 * - Never touch audio in the last MIN_LEAD_MINUTES before a ring.
 * If the app is not opened inside the window, the alarm still rings with the
 * last message it has (iOS gives us no guaranteed background run).
 */
export const PREPARE_WINDOW_HOURS = 10;
const MIN_LEAD_MINUTES = 10;
const MAX_BUILDS_PER_RING = 2;
const STATE_KEY = 'fsa.wake_prep.v1';

type PrepRecord = { ring: string; builds: number; moodKey: string };
type PrepState = Record<string, PrepRecord>;

export function moodKeyOf(mood: { label: string; note?: string } | null) {
  return mood ? `${mood.label}|${mood.note ?? ''}` : '';
}

async function readState(): Promise<PrepState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(state: PrepState) {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
}

/** Next ring of this alarm, if it falls inside the prepare window. */
function ringInWindow(alarm: Alarm, now = Date.now()) {
  const next = nextAlarmOccurrences(alarm, 1)[0];
  if (!next) return null;
  const minutes = (next.getTime() - now) / 60000;
  if (minutes < MIN_LEAD_MINUTES || minutes > PREPARE_WINDOW_HOURS * 60) {
    return null;
  }
  return next.toISOString();
}

/**
 * Record a build that happened elsewhere (alarm just created/edited) so the
 * window does not immediately pay for the same ring again.
 */
export async function markRingPrepared(
  alarm: Alarm,
  mood: { label: string; note?: string } | null
) {
  const ring = ringInWindow(alarm);
  if (!ring) return;
  const state = await readState();
  const prev = state[alarm.id];
  state[alarm.id] = {
    ring,
    builds: prev?.ring === ring ? prev.builds + 1 : 1,
    moodKey: moodKeyOf(mood),
  };
  await writeState(state);
}

export async function maybeEveningRegen(params: {
  alarms: Alarm[];
  voiceId: string | null;
  answers: OnboardingAnswers;
  mood: { label: string; note?: string } | null;
  paused?: boolean;
  updateAlarm: (id: string, patch: Partial<Alarm>) => void;
}) {
  const { alarms, voiceId, answers, mood, paused, updateAlarm } = params;
  if (paused || !voiceId) return;

  const state = await readState();
  const moodKey = moodKeyOf(mood);

  // Drop records for alarms that no longer exist.
  for (const id of Object.keys(state)) {
    if (!alarms.some((a) => a.id === id)) delete state[id];
  }

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const ring = ringInWindow(alarm);
    if (!ring) continue;

    const rec = state[alarm.id];
    const builds = rec?.ring === ring ? rec.builds : 0;
    const needsFirst = builds === 0;
    const moodChanged = builds > 0 && rec?.moodKey !== moodKey;
    if (!needsFirst && !(moodChanged && builds < MAX_BUILDS_PER_RING)) continue;

    try {
      const { uri, text } = await buildAlarmAudioForId({
        alarmId: alarm.id,
        voiceId,
        answers,
        mood,
      });
      updateAlarm(alarm.id, { audioUri: uri, scriptText: text });
      await scheduleAlarmNotifications(
        { ...alarm, audioUri: uri, scriptText: text },
        uri
      );
      state[alarm.id] = { ring, builds: builds + 1, moodKey };
      await writeState(state);
    } catch (error) {
      // Keep the previous message; the alarm still rings with it.
      console.warn('Wake prep failed', error);
    }
  }
  await writeState(state);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, InteractionManager } from 'react-native';
import {
  cancelScheduledAlarm,
  consumeAlarmKitLaunch,
  rescheduleAllAlarms,
} from '../services/alarmScheduler';
import { cancelAllAlarmNotifications } from '../services/resetApp';

/** 0 = Monday … 6 = Sunday */
export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  label: string;
  enabled: boolean;
  days: number[];
  /** Re-wake ~every snoozeMinutes if you don’t tap I’m up (default on, 10 min). */
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  /** Extra haptic buzz when the alarm fires in-app. */
  vibrate: boolean;
  audioUri?: string | null;
  scriptText?: string | null;
  /** Last voice build failed — rings with the fallback tone until a retry works. */
  voiceFailed?: boolean;
};

export function normalizeAlarm(raw: Partial<Alarm> & { id: string }): Alarm {
  return {
    id: raw.id,
    hour: typeof raw.hour === 'number' ? raw.hour : 7,
    minute: typeof raw.minute === 'number' ? raw.minute : 30,
    label: typeof raw.label === 'string' ? raw.label : 'Morning Future Self',
    enabled: raw.enabled !== false,
    days: Array.isArray(raw.days) ? raw.days : [],
    // Default on — call back in ~10 min until I’m up (not the same as OS sound-loop).
    snoozeEnabled: raw.snoozeEnabled !== false,
    snoozeMinutes:
      typeof raw.snoozeMinutes === 'number' && raw.snoozeMinutes > 0
        ? raw.snoozeMinutes
        : 10,
    vibrate: raw.vibrate !== false,
    audioUri: raw.audioUri ?? null,
    scriptText: raw.scriptText ?? null,
    voiceFailed: raw.voiceFailed === true,
  };
}

type AlarmsContextValue = {
  alarms: Alarm[];
  ready: boolean;
  addAlarm: (alarm: Omit<Alarm, 'id'>) => Alarm;
  updateAlarm: (id: string, patch: Partial<Alarm>) => void;
  toggleAlarm: (id: string) => void;
  removeAlarm: (id: string) => void;
  clearAllAlarms: () => Promise<void>;
  nextAlarm: Alarm | null;
  refreshSchedules: () => Promise<void>;
};

export const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const DAY_NAMES = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

export const WEEKDAYS = [0, 1, 2, 3, 4];
export const WEEKENDS = [5, 6];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const STORAGE_KEY = 'future_self_alarms_v1';

const AlarmsContext = createContext<AlarmsContextValue | null>(null);

function makeId() {
  return `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function alarmSortKey(a: Alarm) {
  return a.hour * 60 + a.minute;
}

function sameDays(a: number[], b: number[]) {
  return [...a].sort().join() === [...b].sort().join();
}

function pickNext(alarms: Alarm[]) {
  const enabled = alarms.filter((a) => a.enabled);
  if (!enabled.length) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const jsDay = now.getDay();
  const today = jsDay === 0 ? 6 : jsDay - 1;
  const sorted = [...enabled].sort((a, b) => alarmSortKey(a) - alarmSortKey(b));

  const laterToday = sorted.find(
    (a) =>
      (a.days.length === 0 || a.days.includes(today)) &&
      alarmSortKey(a) > nowMinutes
  );
  if (laterToday) return laterToday;

  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (today + offset) % 7;
    const match = sorted.find(
      (a) => a.days.length === 0 || a.days.includes(day)
    );
    if (match) return match;
  }
  return sorted[0] ?? null;
}

export function formatAlarmTime(alarm: Pick<Alarm, 'hour' | 'minute'>) {
  return `${String(alarm.hour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}`;
}

export function formatAlarmDays(days: number[]) {
  if (!days.length) return 'once';
  if (sameDays(days, EVERY_DAY)) return 'every day';
  if (sameDays(days, WEEKDAYS)) return 'mon-fri';
  if (sameDays(days, WEEKENDS)) return 'sat-sun';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d].toLowerCase())
    .join(', ');
}

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [ready, setReady] = useState(false);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2000);

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Alarm>[];
          setAlarms(
            Array.isArray(parsed)
              ? parsed
                  .filter((a): a is Partial<Alarm> & { id: string } =>
                    Boolean(a && typeof a.id === 'string')
                  )
                  .map(normalizeAlarm)
              : []
          );
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms)).catch(() => {});
  }, [alarms, ready]);

  const refreshSchedules = useCallback(async () => {
    const audioByAlarmId = Object.fromEntries(
      alarms.map((a) => [a.id, a.audioUri ?? null])
    );
    await rescheduleAllAlarms(alarms, audioByAlarmId);
  }, [alarms]);

  const clearAllAlarms = useCallback(async () => {
    const list = alarmsRef.current;
    await Promise.all(
      list.map((a) => cancelScheduledAlarm(a.id).catch(() => undefined))
    );
    await cancelAllAlarmNotifications();
    setAlarms([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  // Defer heavy native scheduling so Home paints first. Create/edit still
  // schedules immediately via scheduleAlarmNotifications.
  // Deps = [ready] only — re-running on every alarms change froze the UI.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        const list = alarmsRef.current;
        const audioByAlarmId = Object.fromEntries(
          list.map((a) => [a.id, a.audioUri ?? null])
        );
        void rescheduleAllAlarms(list, audioByAlarmId).catch(() => {});
      });
    }, 8000);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const audioByAlarmId = Object.fromEntries(
      alarmsRef.current.map((a) => [a.id, a.audioUri ?? null])
    );
    void consumeAlarmKitLaunch(audioByAlarmId).catch(() => {});

    // Warm launch: app was already in memory when Stop / Snooze opened it.
    // The intent may set its payload just after we become active — read twice.
    let retry: ReturnType<typeof setTimeout> | null = null;
    let lastTopUp = Date.now();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      // Notification-path wakes are pre-scheduled only N days ahead — top the
      // window up whenever the app comes back (at most every 30 min).
      if (Date.now() - lastTopUp > 30 * 60 * 1000) {
        lastTopUp = Date.now();
        const list = alarmsRef.current;
        void rescheduleAllAlarms(
          list,
          Object.fromEntries(list.map((a) => [a.id, a.audioUri ?? null]))
        ).catch(() => {});
      }
      const consume = () => {
        const byId = Object.fromEntries(
          alarmsRef.current.map((a) => [a.id, a.audioUri ?? null])
        );
        void consumeAlarmKitLaunch(byId).catch(() => {});
      };
      consume();
      if (retry) clearTimeout(retry);
      retry = setTimeout(consume, 800);
    });
    return () => {
      sub.remove();
      if (retry) clearTimeout(retry);
    };
  }, [ready]);

  const value = useMemo<AlarmsContextValue>(
    () => ({
      alarms,
      ready,
      nextAlarm: pickNext(alarms),
      refreshSchedules,
      addAlarm: (alarm) => {
        const next = normalizeAlarm({ ...alarm, id: makeId() });
        setAlarms((prev) => [...prev, next]);
        return next;
      },
      updateAlarm: (id, patch) =>
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === id ? normalizeAlarm({ ...a, ...patch, id }) : a
          )
        ),
      toggleAlarm: (id) => {
        setAlarms((prev) => {
          const next = prev.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
          );
          const row = next.find((a) => a.id === id);
          if (row) {
            void (async () => {
              try {
                if (!row.enabled) {
                  await cancelScheduledAlarm(id);
                  return;
                }
                const { scheduleAlarmNotifications } = await import(
                  '../services/alarmScheduler'
                );
                await scheduleAlarmNotifications(row, row.audioUri ?? null);
              } catch {
                // ignore schedule errors on toggle
              }
            })();
          }
          return next;
        });
      },
      removeAlarm: (id) => {
        void cancelScheduledAlarm(id);
        setAlarms((prev) => prev.filter((a) => a.id !== id));
      },
      clearAllAlarms,
    }),
    [alarms, ready, refreshSchedules, clearAllAlarms]
  );

  return (
    <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>
  );
}

export function useAlarms() {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error('useAlarms must be used within AlarmsProvider');
  return ctx;
}

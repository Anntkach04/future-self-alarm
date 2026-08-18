import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  cancelScheduledAlarm,
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
  snoozeMinutes: number;
  audioUri?: string | null;
  scriptText?: string | null;
};

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
  if (sameDays(days, WEEKDAYS)) return 'mon–fri';
  if (sameDays(days, WEEKENDS)) return 'sat–sun';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d].toLowerCase())
    .join(', ');
}

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Alarm[];
          setAlarms(Array.isArray(parsed) ? parsed : []);
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
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
    await cancelAllAlarmNotifications();
    setAlarms([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refreshSchedules();
  }, [ready, refreshSchedules]);

  const value = useMemo<AlarmsContextValue>(
    () => ({
      alarms,
      ready,
      nextAlarm: pickNext(alarms),
      refreshSchedules,
      addAlarm: (alarm) => {
        const next = { ...alarm, id: makeId() };
        setAlarms((prev) => [...prev, next]);
        return next;
      },
      updateAlarm: (id, patch) =>
        setAlarms((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
        ),
      toggleAlarm: (id) =>
        setAlarms((prev) =>
          prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
        ),
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

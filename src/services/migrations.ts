import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from './resetApp';

/** Bump when AsyncStorage shape changes in a breaking way. */
export const STORAGE_SCHEMA_VERSION = 1;

const SCHEMA_KEY = APP_STORAGE_KEYS.storageSchema;

type Migration = {
  to: number;
  run: () => Promise<void>;
};

/**
 * v0 → v1: ensure known keys parse; normalize legacy alarm snooze default.
 * Safe no-op if already on v1.
 */
const migrations: Migration[] = [
  {
    to: 1,
    run: async () => {
      const raw = await AsyncStorage.getItem(APP_STORAGE_KEYS.alarms);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        let changed = false;
        const next = parsed.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const alarm = row as Record<string, unknown>;
          if (
            typeof alarm.snoozeMinutes !== 'number' ||
            alarm.snoozeMinutes <= 0
          ) {
            changed = true;
            return { ...alarm, snoozeMinutes: 10 };
          }
          return alarm;
        });
        if (changed) {
          await AsyncStorage.setItem(
            APP_STORAGE_KEYS.alarms,
            JSON.stringify(next)
          );
        }
      } catch {
        // Leave corrupt blob; contexts will fall back to defaults.
      }
    },
  },
];

/**
 * Run before providers hydrate. Never wipes user data.
 */
export async function runStorageMigrations(): Promise<number> {
  let current = 0;
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) current = n;
    }
  } catch {
    current = 0;
  }

  const pending = migrations
    .filter((m) => m.to > current)
    .sort((a, b) => a.to - b.to);

  for (const step of pending) {
    await step.run();
    current = step.to;
    await AsyncStorage.setItem(SCHEMA_KEY, String(current)).catch(() => {});
  }

  if (current < STORAGE_SCHEMA_VERSION) {
    current = STORAGE_SCHEMA_VERSION;
    await AsyncStorage.setItem(SCHEMA_KEY, String(current)).catch(() => {});
  }

  return current;
}

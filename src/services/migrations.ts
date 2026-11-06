import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from './resetApp';

/** Bump when AsyncStorage shape changes in a breaking way. */
export const STORAGE_SCHEMA_VERSION = 9;

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
  {
    // Nokia hiss mix — wipe cached MP3/CAF so phone stops playing old spa audio.
    to: 2,
    run: async () => clearCachedAlarmAndPreviewAudio(),
  },
  {
    // CAF wake sound no longer loudnorm/ADPCM — force regen.
    to: 3,
    run: async () => clearCachedAlarmAndPreviewAudio(),
  },
  {
    // Also delete Library/Sounds fs_alarm_*.caf (bali still playing from disk).
    to: 4,
    run: async () => {
      await clearCachedAlarmAndPreviewAudio();
      try {
        const { clearFutureSelfAlarmSounds } = await import(
          '../../modules/ios-library-sounds/src'
        );
        await clearFutureSelfAlarmSounds();
      } catch {
        // native module may be missing until rebuild
      }
    },
  },
  {
    // Longer wake script + quieter hiss — force regen.
    to: 5,
    run: async () => clearCachedAlarmAudioAndSounds(),
  },
  {
    // Soft calm bed + longer letter — force regen.
    to: 6,
    run: async () => clearCachedAlarmAudioAndSounds(),
  },
  {
    // Cap wake ≤28s (no mid-cut loop) — force regen.
    to: 7,
    run: async () => clearCachedAlarmAudioAndSounds(),
  },
  {
    // ima4 CAF so AlarmKit/notifications play voice (not system default).
    to: 8,
    run: async () => clearCachedAlarmAudioAndSounds(),
  },
  {
    // Vintage landline mix + restore 10-min snooze default.
    to: 9,
    run: async () => {
      await clearCachedAlarmAudioAndSounds();
      const raw = await AsyncStorage.getItem(APP_STORAGE_KEYS.alarms);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const next = parsed.map((row) => {
          if (!row || typeof row !== 'object') return row;
          return { ...(row as object), snoozeEnabled: true, snoozeMinutes: 10 };
        });
        await AsyncStorage.setItem(
          APP_STORAGE_KEYS.alarms,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
    },
  },
];

async function clearCachedAlarmAudioAndSounds() {
  await clearCachedAlarmAndPreviewAudio();
  try {
    const { clearFutureSelfAlarmSounds } = await import(
      '../../modules/ios-library-sounds/src'
    );
    await clearFutureSelfAlarmSounds();
  } catch {
    // ignore
  }
}

async function clearCachedAlarmAndPreviewAudio() {
  const raw = await AsyncStorage.getItem(APP_STORAGE_KEYS.alarms);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const next = parsed.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const alarm = row as Record<string, unknown>;
          return { ...alarm, audioUri: null, systemSoundName: null };
        });
        await AsyncStorage.setItem(
          APP_STORAGE_KEYS.alarms,
          JSON.stringify(next)
        );
      }
    } catch {
      // ignore
    }
  }
  const onboardingRaw = await AsyncStorage.getItem(APP_STORAGE_KEYS.onboarding);
  if (onboardingRaw) {
    try {
      const parsed = JSON.parse(onboardingRaw) as {
        voice?: Record<string, unknown>;
      };
      if (parsed?.voice) {
        parsed.voice = {
          ...parsed.voice,
          previewUri: null,
          previewText: null,
        };
        await AsyncStorage.setItem(
          APP_STORAGE_KEYS.onboarding,
          JSON.stringify(parsed)
        );
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Run before providers hydrate.
 *
 * IMPORTANT for App Store updates:
 * - Never clear voiceId / onboarding profile.
 * - Clearing audioUri/CAF (mix changes) is OK only because
 *   `AlarmAudioRepairHost` rebuilds from voiceId on next launch.
 * - Do not bump schema with a wipe unless that repair path stays.
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

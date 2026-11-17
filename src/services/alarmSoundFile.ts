import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  librarySoundExists,
  writeLibrarySoundBase64,
} from '../../modules/ios-library-sounds/src';
import { authHeaders } from './apiAuth';
import { getApiUrl } from './elevenlabs';

/** Filename for iOS Library/Sounds + notification `sound` (must include extension). */
export function alarmSoundFileName(alarmId: string) {
  const safe = alarmId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return `fs_alarm_${safe}.caf`;
}

/** AlarmKit `.named(...)` — include .caf so the system can resolve Library/Sounds. */
export function alarmSoundBaseName(alarmId: string) {
  return alarmSoundFileName(alarmId);
}

function librarySoundsDirectory() {
  const docs = FileSystem.documentDirectory;
  if (!docs) return null;
  const normalized = docs.endsWith('/') ? docs : `${docs}/`;
  if (normalized.includes('/Documents/')) {
    return normalized.replace('/Documents/', '/Library/Sounds/');
  }
  return `${normalized}../Library/Sounds/`;
}

export function alarmSoundPath(alarmId: string) {
  const root = librarySoundsDirectory();
  return root ? `${root}${alarmSoundFileName(alarmId)}` : null;
}

/**
 * Apple UNNotificationSound / AlarmKit custom sounds must be < 30s.
 * We encode ≤28s so the CAF never trips the system default-sound fallback.
 * Longer AI scripts still live as the full MP3 for in-app playback.
 */
export const ALARM_WAKE_SOUND_MAX_SECONDS = 28;

/**
 * Per-ring wake sound. Every build gets a NEW file name: iOS / AlarmKit may
 * keep playing a cached sound when a file is overwritten under the same name.
 * Prefix differs from `fs_alarm_`: migrations that wipe base sounds keep it.
 */
export function ringSoundFileName(alarmId: string, ringMs: number) {
  const safe = alarmId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const stamp = Date.now().toString(36);
  return `fs_ring_${safe}_${ringMs.toString(36)}_${stamp}.caf`;
}

/** MP3 → ≤28s CAF (base64) via the API. */
async function convertToWakeSound(mp3Uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('System wake sound is iOS/Android only');
  }

  const mp3Info = await FileSystem.getInfoAsync(mp3Uri);
  if (!mp3Info.exists) {
    throw new Error('Alarm audio missing. Regenerate the alarm.');
  }

  const mp3Base64 = await FileSystem.readAsStringAsync(mp3Uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(`${getApiUrl()}/api/audio/to-alarm-sound`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      base64: mp3Base64,
      maxSeconds: ALARM_WAKE_SOUND_MAX_SECONDS,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not build wake sound (${response.status}): ${text.slice(0, 180)}`
    );
  }
  const data = (await response.json()) as { base64?: string };
  if (!data.base64 || data.base64.length < 64) {
    throw new Error('Wake sound conversion returned empty audio');
  }
  return data.base64;
}

async function writeWakeSound(fileName: string, base64: string) {
  if (Platform.OS === 'ios') {
    const uri = await writeLibrarySoundBase64(fileName, base64);
    if (!(await librarySoundExists(fileName))) {
      throw new Error('Wake sound file was not written correctly');
    }
    return uri;
  }
  const destDir = librarySoundsDirectory() || FileSystem.documentDirectory;
  if (!destDir) {
    throw new Error('Could not resolve storage for wake sound');
  }
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(
    () => undefined
  );
  const uri = `${destDir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/** Build the wake sound for one ring under a fresh, never-reused name. */
export async function installRingSound(params: {
  alarmId: string;
  ringMs: number;
  mp3Uri: string;
}): Promise<string> {
  const base64 = await convertToWakeSound(params.mp3Uri);
  const fileName = ringSoundFileName(params.alarmId, params.ringMs);
  await writeWakeSound(fileName, base64);
  return fileName;
}

export async function deleteWakeSound(fileName: string | null | undefined) {
  if (!fileName || Platform.OS === 'web') return;
  const root = librarySoundsDirectory();
  if (!root) return;
  await FileSystem.deleteAsync(`${root}${fileName}`, { idempotent: true }).catch(
    () => undefined
  );
}

/**
 * Convert full alarm MP3 into a ≤28s CAF in Library/Sounds
 * (required for locked-screen custom wake sound).
 */
export async function installAlarmSystemSound(params: {
  alarmId: string;
  mp3Uri: string;
}): Promise<{ fileName: string; soundName: string; uri: string }> {
  const base64 = await convertToWakeSound(params.mp3Uri);
  const fileName = alarmSoundFileName(params.alarmId);

  // Only this alarm's file: wiping every fs_alarm_*.caf here silently took
  // the voice away from the user's OTHER alarms (they fell back to the tone).
  await deleteWakeSound(fileName);
  const uri = await writeWakeSound(fileName, base64);
  return { fileName, soundName: fileName, uri };
}

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  clearFutureSelfAlarmSounds,
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
 * Convert full alarm MP3 into a ≤28s CAF in Library/Sounds
 * (required for locked-screen custom wake sound).
 */
export async function installAlarmSystemSound(params: {
  alarmId: string;
  mp3Uri: string;
}): Promise<{ fileName: string; soundName: string; uri: string }> {
  if (Platform.OS === 'web') {
    throw new Error('System wake sound is iOS/Android only');
  }

  const mp3Info = await FileSystem.getInfoAsync(params.mp3Uri);
  if (!mp3Info.exists) {
    throw new Error('Alarm audio missing. Regenerate the alarm.');
  }

  const mp3Base64 = await FileSystem.readAsStringAsync(params.mp3Uri, {
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

  const fileName = alarmSoundFileName(params.alarmId);

  if (Platform.OS === 'ios') {
    // Always wipe old CAFs first — AsyncStorage clear does not delete Library/Sounds.
    await clearFutureSelfAlarmSounds();
    const uri = await writeLibrarySoundBase64(fileName, data.base64);
    // Do NOT also write a shared FutureYouWake.caf — it contaminated later
    // alarms with whatever voice was generated last (often a premade demo).
    const exists = await librarySoundExists(fileName);
    if (!exists) {
      throw new Error('Wake sound file was not written correctly');
    }
    return { fileName, soundName: fileName, uri };
  }

  const destDir = librarySoundsDirectory() || FileSystem.documentDirectory;
  if (!destDir) {
    throw new Error('Could not resolve storage for wake sound');
  }
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(
    () => undefined
  );
  const uri = `${destDir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, data.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { fileName, soundName: fileName, uri };
}

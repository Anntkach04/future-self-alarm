import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export async function savePreviewAudio(base64: string) {
  return saveAlarmAudio(base64, `preview-${Date.now()}`);
}

export async function saveAlarmAudio(base64: string, id: string) {
  if (Platform.OS === 'web') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }

  const root = FileSystem.documentDirectory;
  if (!root) {
    throw new Error('No document directory available on this platform');
  }

  const dir = `${root}alarms/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}${id}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export async function alarmAudioExists(id: string) {
  if (Platform.OS === 'web') return false;
  const root = FileSystem.documentDirectory;
  if (!root) return false;
  const info = await FileSystem.getInfoAsync(`${root}alarms/${id}.mp3`);
  return info.exists;
}

export function alarmAudioPath(id: string) {
  const root = FileSystem.documentDirectory;
  return root ? `${root}alarms/${id}.mp3` : null;
}

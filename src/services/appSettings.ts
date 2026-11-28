import { Linking } from 'react-native';

/**
 * Open this app's page in iPhone Settings (Alarms, Notifications,
 * Microphone…). Linking.openSettings() uses the official
 * openSettingsURLString; the old hard-coded 'app-settings:' URL silently did
 * nothing on some iOS versions, so the buttons looked dead.
 */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    try {
      await Linking.openURL('app-settings:');
      return true;
    } catch {
      return false;
    }
  }
}

/** A permission call that may never resolve must not freeze a button. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

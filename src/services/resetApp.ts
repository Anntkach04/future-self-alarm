import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const APP_STORAGE_KEYS = {
  onboarding: 'fsa.onboarding.v1',
  alarms: 'future_self_alarms_v1',
} as const;

export async function cancelAllAlarmNotifications() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}

export async function clearPersistedAppData() {
  await AsyncStorage.multiRemove(Object.values(APP_STORAGE_KEYS));
  await cancelAllAlarmNotifications();
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { hasNotificationPermissions } from './alarmScheduler';

const ID = 'fs_trial_reminder';
const BEFORE_MS = 2 * 24 * 60 * 60 * 1000;

/** True when a trial-ending reminder can actually be delivered. */
export async function canRemindTrialEnd() {
  if (Platform.OS === 'web') return false;
  try {
    return await hasNotificationPermissions();
  } catch {
    return false;
  }
}

/** Local reminder two days before the free trial turns into a charge. */
export async function scheduleTrialEndReminder(expiresAt: string | null) {
  if (!expiresAt || !(await canRemindTrialEnd())) return;
  const end = new Date(expiresAt).getTime();
  const at = end - BEFORE_MS;
  if (!Number.isFinite(at) || at <= Date.now() + 60 * 1000) return;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'Your free week ends in 2 days',
      body: 'Keep waking up to your own voice, or cancel anytime in Settings.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
    },
  }).catch(() => undefined);
}

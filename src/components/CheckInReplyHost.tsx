import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { deliverCheckIn } from '../services/checkInBridge';
import { CHECKIN_CATEGORY, CHECKIN_REPLY_ACTION } from '../services/nudges';

/**
 * The evening nudge has a "Reply" field (long-press the notification). The
 * typed words become today's check-in. Also catches the reply that launched
 * the app from a killed state.
 */
export function CheckInReplyHost() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const seen = new Set<string>();
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (response.actionIdentifier !== CHECKIN_REPLY_ACTION) return;
      const id = response.notification.request.identifier;
      if (seen.has(id)) return;
      seen.add(id);
      if (response.userText) deliverCheckIn(response.userText);
      void Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    };
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
  return null;
}

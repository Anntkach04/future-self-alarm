import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Feedback only — no synthetic blips (they sounded harsh on device).
 * Haptics on native; silent on web.
 */

/** When a script line is accepted. */
export async function playLineSuccessSound() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  });
}

/** When the “You’re all set” screen appears. */
export async function playAllSetSound() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  );
}

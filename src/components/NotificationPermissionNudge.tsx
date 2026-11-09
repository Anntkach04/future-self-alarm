import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  ensureNotificationPermissions,
  hasNotificationPermissions,
} from '../services/alarmScheduler';
import { accents, colors, fonts, spacing } from '../theme';

type Props = {
  /** Where the sheet sits — home uses absolute top banners; create uses bottom. */
  placement?: 'bottom' | 'top';
};

/**
 * Bottom/top sheet when alerts are off — Allow opens the system prompt (or Settings).
 */
export function NotificationPermissionNudge({ placement = 'bottom' }: Props) {
  const insets = useSafeAreaInsets();
  const { notificationsReady, setNotificationsReady } = useAppSettings();
  const [needs, setNeeds] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const ok = await hasNotificationPermissions();
    setNotificationsReady(ok);
    setNeeds(!ok);
  }, [setNotificationsReady]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Keep in sync if settings flag flips elsewhere.
  useEffect(() => {
    if (notificationsReady) setNeeds(false);
  }, [notificationsReady]);

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await ensureNotificationPermissions();
      setNotificationsReady(ok);
      if (ok) {
        setNeeds(false);
        return;
      }
      // Already denied once — open Settings so they can flip Alerts on.
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!needs) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        placement === 'bottom'
          ? { bottom: Math.max(insets.bottom, 12) + 8 }
          : { top: Math.max(insets.top, 8) + 8 },
      ]}
    >
      <View style={styles.sheet}>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.text}>
          Allow alerts for alarms, or your morning voice will not ring when the
          phone is locked.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onAllow()}
          style={styles.btn}
          disabled={busy}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnText}>{busy ? '…' : 'Allow alerts'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.inset,
    right: spacing.inset,
    zIndex: 60,
  },
  sheet: {
    backgroundColor: accents.mist,
    borderRadius: 24,
    padding: 14,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  btn: {
    backgroundColor: accents.gold,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
});

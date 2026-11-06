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
  ensureAlarmKitReady,
  hasAlarmKitPermission,
} from '../services/alarmScheduler';
import { accents, colors, fonts, spacing } from '../theme';

type Props = {
  placement?: 'bottom' | 'top';
};

/**
 * When AlarmKit was denied — Allow retries the sheet, or opens Settings.
 */
export function AlarmPermissionNudge({ placement = 'bottom' }: Props) {
  const insets = useSafeAreaInsets();
  const { alarmKitReady, setAlarmKitReady } = useAppSettings();
  const [needs, setNeeds] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setNeeds(false);
      return;
    }
    const ok = await hasAlarmKitPermission();
    setAlarmKitReady(ok);
    setNeeds(!ok);
  }, [setAlarmKitReady]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (alarmKitReady) setNeeds(false);
  }, [alarmKitReady]);

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await ensureAlarmKitReady(true);
      setAlarmKitReady(ok);
      if (ok) {
        setNeeds(false);
        return;
      }
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!needs || Platform.OS !== 'ios') return null;

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
          Turn on alarms so Future You can wake you.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onAllow()}
          style={styles.btn}
          disabled={busy}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnText}>{busy ? '…' : 'Allow alarms'}</Text>
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
    zIndex: 59,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 18,
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
    backgroundColor: accents.sky,
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

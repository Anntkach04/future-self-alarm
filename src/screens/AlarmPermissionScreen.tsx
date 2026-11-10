import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { FeatureList, type FeatureItem } from '../components/FeatureList';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import {
  ensureAlarmKitReady,
  ensureNotificationPermissions,
  hasNotificationPermissions,
} from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AlarmPermission'>;

/** null = not asked yet, true = allowed, false = declined. */
type Answer = boolean | null;

/**
 * Explains both permissions, then lets iOS show its own two sheets
 * (notifications, then AlarmKit). Each row turns into a check once allowed.
 * iOS shows a sheet only the first time; if one was declined before, the
 * row offers "turn on" (opens this app's page in Settings).
 */
export function AlarmPermissionScreen({ navigation }: Props) {
  const { setAlarmKitReady, setNotificationsReady } = useAppSettings();
  const [notif, setNotif] = useState<Answer>(null);
  const [alarm, setAlarm] = useState<Answer>(null);
  const [busy, setBusy] = useState(false);
  const asked = notif !== null || alarm !== null;
  const leaving = useRef(false);

  // Already allowed earlier (e.g. reinstall): show the check right away.
  useEffect(() => {
    void (async () => {
      if (await hasNotificationPermissions()) setNotif(true);
      else {
        const current = await Notifications.getPermissionsAsync().catch(() => null);
        if (current && !current.canAskAgain) setNotif(false);
      }
    })();
  }, []);

  const goNext = () => {
    if (leaving.current) return;
    leaving.current = true;
    navigation.replace('Paywall');
  };

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const notifOk = await ensureNotificationPermissions();
      setNotif(notifOk);
      setNotificationsReady(notifOk);
      const alarmOk = await ensureAlarmKitReady(true);
      setAlarm(alarmOk);
      setAlarmKitReady(alarmOk);
      // Let the checks land before moving on.
      if (notifOk && alarmOk) setTimeout(goNext, 700);
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => void Linking.openSettings().catch(() => undefined);

  const items: FeatureItem[] = [
    {
      icon: 'bell',
      title: 'Notifications',
      body: 'Your voice reaches you, even with Focus on.',
      done: notif === true,
      action: notif === false ? { label: 'turn on', onPress: openSettings } : undefined,
    },
    {
      icon: 'alarm',
      title: 'Alarms',
      body: 'A real system alarm, just like Clock.',
      done: alarm === true,
      action: alarm === false ? { label: 'turn on', onPress: openSettings } : undefined,
    },
  ];

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>
        {'Let future you\nwake you up'}
      </Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        Allow both so your alarm rings on time, even when the phone is locked.
      </Text>

      <FeatureList items={items} color={accents.gold} />

      <View style={styles.actions}>
        {asked ? (
          <TextArrowButton wide label="continue" color={accents.gold} onPress={goNext} disabled={busy} />
        ) : (
          <TextArrowButton wide label="allow" color={accents.gold} onPress={() => void allow()} disabled={busy} />
        )}
        {asked && (notif === false || alarm === false) ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.note}>
            You can turn these on later from Home.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

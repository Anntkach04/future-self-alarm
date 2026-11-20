import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { formatDateKey } from '../utils/dates';
import { StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import {
  ensureAlarmKitReady,
  ensureNotificationPermissions,
  hasAlarmKitPermission,
} from '../services/alarmScheduler';
import { openAppSettings, withTimeout } from '../services/appSettings';
import { accents, colors, fonts, noFakeBold, spacing, opticalLeft } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

export function NotificationSettingsScreen({}: Props) {
  const { notificationsReady, setNotificationsReady, setPauseDays, pauseUntil, isPaused } =
    useAppSettings();

  const { alarmKitReady, setAlarmKitReady } = useAppSettings();
  const allOn = notificationsReady && alarmKitReady;

  /**
   * Missing permission: ask (iOS shows its sheet only the first time), and
   * if it stays off, open this app's page in Settings. Everything on: the
   * button just opens Settings, to change or turn things off there. (It
   * used to do nothing at all when alerts were already on.)
   */
  const onPress = async () => {
    if (allOn) {
      await openAppSettings();
      return;
    }
    const notif = await withTimeout(ensureNotificationPermissions(), 5000, false);
    setNotificationsReady(notif);
    const alarms = await withTimeout(ensureAlarmKitReady(true), 5000, false);
    setAlarmKitReady(alarms);
    if (!notif || !alarms) await openAppSettings();
  };

  // Settings may have changed while the app was in the background.
  useEffect(() => {
    void hasAlarmKitPermission().then(setAlarmKitReady);
    void Notifications.getPermissionsAsync().then((current) =>
      setNotificationsReady(
        Boolean(
          current.granted ||
            current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
        )
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>Notifications</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        {allOn
          ? 'Alarms and alerts are on.'
          : !alarmKitReady
            ? 'Alarms are off, so your voice can’t wake you yet.'
            : 'Alerts are off, so your mornings can’t ring yet.'}
      </Text>

      <View style={styles.block}>
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.blockTitle}>Pause all alarms</Text>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.blockBody}>
          {isPaused && pauseUntil
            ? `Paused until ${formatDateKey(pauseUntil)}. Alarms come back on by themselves.`
            : 'Turn everything off for a few days. Vacation mode.'}
        </Text>
        <View style={styles.row}>
          <TextArrowButton
            label="3 days"
            color={accents.gold}
            onPress={() => setPauseDays(3)}
          />
          <TextArrowButton
            label="7 days"
            color={colors.fab}
            onPress={() => setPauseDays(7)}
          />
          {isPaused ? (
            <TextArrowButton
              label="resume now"
              color={accents.lime}
              onPress={() => setPauseDays(null)}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Text maxFontSizeMultiplier={1.4} style={styles.hint}>
          {allOn
            ? 'To change or turn them off, use iPhone Settings.'
            : 'Turn them on so Future Self can wake you.'}
        </Text>
        <TextArrowButton
          wide
          label={allOn ? 'iphone settings' : 'turn on alarms'}
          // Primary only when something needs fixing.
          color={allOn ? colors.chip : accents.lime}
          onPress={() => void onPress()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  hint: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    ...opticalLeft(40),
    lineHeight: 44,
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  block: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
    backgroundColor: colors.chip,
  },
  blockTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    ...noFakeBold,
  },
  blockBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
});

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import { ensureNotificationPermissions } from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

export function NotificationSettingsScreen({}: Props) {
  const { notificationsReady, setNotificationsReady, setPauseDays, pauseUntil, isPaused } =
    useAppSettings();

  const refresh = async () => {
    const ok = await ensureNotificationPermissions();
    setNotificationsReady(ok);
    if (!ok && Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else if (!ok) {
      await Linking.openSettings();
    }
    const current = await Notifications.getPermissionsAsync();
    setNotificationsReady(
      Boolean(
        current.granted ||
          current.ios?.status ===
            Notifications.IosAuthorizationStatus.PROVISIONAL
      )
    );
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.body}>
        {notificationsReady
          ? 'Alerts are on. Future You wakes you with a notification + your voice — not the Clock app. Focus modes can still quiet alerts unless Time Sensitive is allowed for Future Self.'
          : 'Alerts are off. We can’t wake you until you allow them in Settings.'}
      </Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Pause all alarms</Text>
        <Text style={styles.blockBody}>
          {isPaused && pauseUntil
            ? `Paused until ${pauseUntil}.`
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
          <TextArrowButton
            label="resume"
            color={accents.lime}
            onPress={() => setPauseDays(null)}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <TextArrowButton
          label={notificationsReady ? 'open system settings' : 'allow alerts'}
          color={accents.coral}
          onPress={() => void refresh()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  block: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  blockTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    ...noFakeBold,
  },
  blockBody: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
});

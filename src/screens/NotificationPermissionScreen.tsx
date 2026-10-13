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

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationPermission'>;

export function NotificationPermissionScreen({ navigation }: Props) {
  const { setNotificationsReady } = useAppSettings();

  const goNext = () => {
    navigation.replace('Paywall');
  };

  const ask = async () => {
    // Notifications only here. Mic/Speech = first record. AlarmKit = first
    // Kit schedule (not asked upfront — we wake via notification + CAF).
    const ok = await ensureNotificationPermissions();
    setNotificationsReady(ok);
    if (ok) {
      goNext();
      return;
    }
    // Denied — offer Settings.
  };

  const openSettings = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
    const current = await Notifications.getPermissionsAsync();
    const ok = Boolean(
      current.granted ||
        current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
    setNotificationsReady(ok);
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>Let Future You{'\n'}wake you</Text>
      <Text style={styles.body}>
        Allow alerts so Future You can play your morning voice when the phone
        is locked or on Silent. This is not the iPhone Clock app. Focus modes,
        Notification Summary, or denied alerts can still quiet the wake — allow
        Time Sensitive alerts for Future Self in Settings if you use Focus.
      </Text>

      <View style={styles.actions}>
        <TextArrowButton
          label="continue"
          color={accents.gold}
          onPress={() => void ask()}
        />
        <TextArrowButton
          label="open settings"
          color={colors.fab}
          onPress={() => void openSettings()}
        />
        <TextArrowButton
          label="not now"
          color={accents.coral}
          onPress={() => {
            setNotificationsReady(false);
            goNext();
          }}
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
    lineHeight: 44,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  actions: {
    marginTop: 'auto',
    gap: 14,
    paddingBottom: spacing.md,
  },
});

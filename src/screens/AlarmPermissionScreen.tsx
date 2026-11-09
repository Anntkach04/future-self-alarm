import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import {
  ensureAlarmKitReady,
  ensureNotificationPermissions,
} from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AlarmPermission'>;

/**
 * One allow screen: notifications then AlarmKit, then paywall.
 * If denied, Home shows bottom Allow → Settings nudges.
 */
export function AlarmPermissionScreen({ navigation }: Props) {
  const { setAlarmKitReady, setNotificationsReady } = useAppSettings();

  const onContinue = async () => {
    const notifOk = await ensureNotificationPermissions();
    setNotificationsReady(notifOk);
    const ok = await ensureAlarmKitReady(true);
    setAlarmKitReady(ok);
    navigation.replace('Paywall');
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>Let Future You{'\n'}wake you up</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        iPhone will ask twice. Allow both so your voice can wake you, even with
        the phone locked or a Focus on:
      </Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        {'1. Notifications: the alert that carries your voice.\n2. Alarms: a real system alarm, like Clock.'}
      </Text>

      <View style={styles.actions}>
        <TextArrowButton
            wide
          label="continue"
          color={accents.gold}
          onPress={() => void onContinue()}
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
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
});

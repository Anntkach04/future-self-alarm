import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import { ensureNotificationPermissions } from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationPermission'>;

/**
 * Like mic: Continue opens the system permission sheet, then we move on.
 * If denied, Home / Create Alarm show a bottom allow prompt later.
 */
export function NotificationPermissionScreen({ navigation }: Props) {
  const { setNotificationsReady } = useAppSettings();

  const onContinue = async () => {
    const ok = await ensureNotificationPermissions();
    setNotificationsReady(ok);
    navigation.replace('AlarmPermission');
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>morning alerts</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        Continue to allow Future Self to wake you with your voice.
      </Text>

      <View style={styles.actions}>
        <TextArrowButton
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

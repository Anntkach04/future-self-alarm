import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { ONBOARDING_RESET_ENABLED } from '../config/devBypass';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

const ROWS: {
  title: string;
  route: 'Subscription' | 'VoiceSettings' | 'NotificationSettings';
}[] = [
  { title: 'Subscription', route: 'Subscription' },
  { title: 'Voice', route: 'VoiceSettings' },
  { title: 'Notifications', route: 'NotificationSettings' },
];

export function MenuScreen({ navigation }: Props) {
  const { resetOnboarding } = useOnboarding();
  const { clearAllAlarms } = useAlarms();

  const confirmReset = () => {
    Alert.alert(
      'Reset everything?',
      'Clears your profile, voice, and alarms. Onboarding starts from the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearAllAlarms();
              await resetOnboarding();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Intro' }],
              });
            })();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.page}>
        <BackButton style={styles.back} />
        <Text style={styles.title}>Menu</Text>
        <View style={styles.list}>
          {ROWS.map((row) => (
            <Pressable
              key={row.route}
              onPress={() => navigation.navigate(row.route)}
              style={styles.row}
            >
              <Text style={styles.rowText}>{row.title}</Text>
            </Pressable>
          ))}
        </View>
        {ONBOARDING_RESET_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={styles.resetBtn}
          >
            <Text style={styles.resetText}>reset (dev)</Text>
          </Pressable>
        ) : null}
        <View style={styles.thanks}>
          <Text style={styles.thanksKicker}>With thanks</Text>
          <Text style={styles.thanksLine}>Voice · ElevenLabs</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 44,
    color: colors.text,
    marginBottom: 32,
    ...noFakeBold,
  },
  list: {
    gap: 8,
  },
  row: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text,
    paddingVertical: 16,
  },
  rowText: {
    fontFamily: fonts.headingRegular,
    fontSize: 26,
    color: colors.text,
    ...noFakeBold,
  },
  resetBtn: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  resetText: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  thanks: {
    marginTop: 'auto',
    paddingBottom: 8,
    gap: 4,
  },
  thanksKicker: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  thanksLine: {
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    color: colors.textMuted,
    ...noFakeBold,
  },
});

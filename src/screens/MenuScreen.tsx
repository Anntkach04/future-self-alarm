import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { Screen } from '../components/Screen';
import { ONBOARDING_RESET_ENABLED } from '../config/devBypass';
import { contactUsUrl, supportMailtoUrl } from '../config/legal';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

const ELEVENLABS_LOGO = require('../../assets/illustrations/elevenlabs-logo.png');
/** Official wordmark (~2082×270). Keep height readable under “With thanks”. */
const LOGO_H = 18;
const LOGO_W = Math.round((LOGO_H * 2082) / 270);

const ROWS: {
  title: string;
  route:
    | 'EditProfile'
    | 'Subscription'
    | 'VoiceSettings'
    | 'NotificationSettings';
}[] = [
  { title: 'Account', route: 'EditProfile' },
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
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>menu</Text>
        <View style={styles.list}>
          {ROWS.map((row) => (
            <Pressable
              key={row.route}
              onPress={() => navigation.navigate(row.route)}
              style={styles.row}
            >
              <Text maxFontSizeMultiplier={1.2} style={styles.rowText}>{row.title}</Text>
            </Pressable>
          ))}
        </View>
        {ONBOARDING_RESET_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={styles.resetBtn}
          >
            <Text maxFontSizeMultiplier={1.5} style={styles.resetText}>reset (dev)</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            const url = contactUsUrl() || supportMailtoUrl('Support');
            void Linking.openURL(url);
          }}
          style={styles.supportBtn}
        >
          <Text maxFontSizeMultiplier={1.5} style={styles.supportText}>Contact Us</Text>
        </Pressable>
        <LegalLinks style={styles.legal} />
        <View style={styles.thanks}>
          <Text maxFontSizeMultiplier={1.5} style={styles.thanksKicker}>With thanks</Text>
          <Image
            source={ELEVENLABS_LOGO}
            style={styles.thanksLogo}
            accessibilityLabel="ElevenLabs"
            resizeMode="contain"
          />
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
  supportBtn: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  supportText: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  legal: {
    marginBottom: 16,
  },
  thanks: {
    paddingBottom: 8,
    gap: 4,
  },
  thanksKicker: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },
  thanksLogo: {
    width: LOGO_W,
    height: LOGO_H,
    opacity: 0.55,
  },
});

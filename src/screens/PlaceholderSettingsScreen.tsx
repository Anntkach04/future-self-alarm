import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold } from '../theme';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Subscription' | 'VoiceSettings' | 'NotificationSettings'
>;

const COPY: Record<
  'Subscription' | 'VoiceSettings' | 'NotificationSettings',
  { title: string; body: string }
> = {
  Subscription: {
    title: 'Subscription',
    body: 'Plans and billing will live here. For now this is a placeholder so the menu has somewhere to go.',
  },
  VoiceSettings: {
    title: 'Voice',
    body: 'Re-record your voice for morning alarms. Cloned Future Self stays attached until you update it.',
  },
  NotificationSettings: {
    title: 'Notifications',
    body: 'Future Self needs permission to wake you. A proper permission screen will be added in onboarding. This page will later open system notification settings.',
  },
};

export function PlaceholderSettingsScreen({ route }: Props) {
  const copy = COPY[route.name];
  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>{copy.title}</Text>
      <View style={styles.block}>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  block: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'transparent',
  },
  body: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    ...noFakeBold,
  },
});

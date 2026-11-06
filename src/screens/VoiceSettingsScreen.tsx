import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { RootStackParamList } from '../navigation/types';
import { PREPARE_WINDOW_HOURS } from '../services/eveningRegen';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceSettings'>;

export function VoiceSettingsScreen({ navigation }: Props) {
  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>voice</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        Every alarm speaks in your cloned voice. Re-record anytime and your
        next alarm will use the new one.
      </Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        A fresh message is written for each alarm in the {PREPARE_WINDOW_HOURS} hours
        before it rings, so the mood you log in the evening shapes your morning.
      </Text>

      <View style={styles.actions}>
        <TextArrowButton
          label="re-record voice"
          color={accents.coral}
          onPress={() => navigation.navigate('VoiceRecord')}
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
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  actions: {
    marginTop: 'auto',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
  },
});

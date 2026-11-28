import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useOnboarding } from '../context/OnboardingContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, mutedPalette, noFakeBold, radii, spacing, typeScale } from '../theme';
import { TextArrowButton } from './TextArrowButton';

/**
 * New onboarding question, asked once on Home for people who onboarded
 * before it existed. Opens the same screen as onboarding.
 */
export function WakeStruggleCard() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { answers, onboardingComplete } = useOnboarding();
  if (!onboardingComplete || answers.wakeStruggle) return null;

  return (
    <View style={styles.card}>
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        How do your mornings usually go?
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={styles.body}>
        One tap, and future you will know how to wake you.
      </Text>
      <View style={styles.action}>
        <TextArrowButton
          label="answer"
          color={colors.bg}
          onPress={() => navigation.navigate('WakeStruggle')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mutedPalette[3],
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  action: {
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
});

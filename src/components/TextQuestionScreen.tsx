import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { BubbleEnter } from './BubbleEnter';
import { InputPill } from './InputPill';
import { accents, colors, fonts, headingClipFix, noFakeBold, spacing } from '../theme';
type Props = {
  question: string;
  subtitle?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoFocus?: boolean;
  accentColor?: string;
};

export function TextQuestionScreen({
  question,
  subtitle,
  value,
  onChangeText,
  onSubmit,
  placeholder = '',
  keyboardType = 'default',
  autoFocus = true,
  accentColor = accents.gold,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BubbleEnter delay={0} fromY={10}>
            <BackButton />
          </BubbleEnter>
          <BubbleEnter delay={0} fromY={16}>
            <View style={styles.header}>
              <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.question}>{question}</Text>
              {subtitle ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </BubbleEnter>
          <BubbleEnter delay={40} fromY={10}>
            <InputPill
              value={value}
              onChangeText={onChangeText}
              onSubmit={onSubmit}
              placeholder={placeholder}
              keyboardType={keyboardType}
              autoFocus={autoFocus}
              buttonColor={accentColor}
            />
          </BubbleEnter>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.webTop + 12,
    paddingBottom: spacing.inset,
  },
  header: {
    width: '100%',
    alignItems: 'stretch',
    marginBottom: 28,
  },
  question: {
    textAlign: 'left',
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 36,
    lineHeight: 44,
    marginBottom: 12,
    alignSelf: 'stretch',
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    textAlign: 'left',
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    alignSelf: 'stretch',
  },
});

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
          <BackButton />
          <BubbleEnter delay={0} fromY={16}>
            <Text style={styles.question}>{question}</Text>
          </BubbleEnter>
          {subtitle ? (
            <BubbleEnter delay={50} fromY={12}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </BubbleEnter>
          ) : null}
          <BubbleEnter delay={100} fromY={14}>
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
    paddingTop: spacing.webTop,
    paddingBottom: spacing.inset,
  },
  question: {
    textAlign: 'left',
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0.2,
    marginBottom: 20,
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    textAlign: 'left',
    fontFamily: fonts.bodyLight,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.37,
    marginBottom: 32,
    ...(Platform.OS === 'web'
      ? ({ fontWeight: '300', fontSynthesis: 'none' } as object)
      : { fontWeight: '300' as const }),
  },
});

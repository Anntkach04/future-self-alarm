import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { BubbleEnter } from './BubbleEnter';
import { RoundArrowButton } from './RoundArrowButton';
import { accents, colors, fonts, headingClipFix, noFakeBold, spacing, opticalLeft } from '../theme';
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
  const canSubmit = value.trim().length > 0;
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
            {/* Same underline field as the chip screens; name set in the serif. */}
            <View style={styles.underline}>
              <TextInput
                maxFontSizeMultiplier={1.3}
                value={value}
                onChangeText={onChangeText}
                onSubmitEditing={() => {
                  if (canSubmit) onSubmit();
                }}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={keyboardType}
                autoFocus={autoFocus}
                autoCorrect={false}
                returnKeyType="next"
                selectionColor={colors.text}
                style={styles.input}
                underlineColorAndroid="transparent"
              />
            </View>
          </BubbleEnter>
        </ScrollView>
        <View style={styles.footer}>
          <RoundArrowButton onPress={onSubmit} disabled={!canSubmit} color={accentColor} />
        </View>
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
    paddingTop: spacing.webTop + spacing.screenTop,
    paddingBottom: spacing.inset,
  },
  header: {
    width: '100%',
    alignItems: 'stretch',
    marginBottom: 24,
  },
  underline: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  input: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    padding: 0,
    borderWidth: 0,
    ...noFakeBold,
  },
  footer: {
    paddingHorizontal: spacing.inset,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'flex-end',
    backgroundColor: colors.bg,
  },
  question: {
    textAlign: 'left',
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 40,
    ...opticalLeft(40),
    lineHeight: 44,
    marginBottom: 16,
    alignSelf: 'stretch',
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    textAlign: 'left',
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    alignSelf: 'stretch',
  },
});

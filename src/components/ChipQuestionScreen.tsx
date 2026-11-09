import { useMemo, useState, type ReactNode } from 'react';
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
import { BubbleChip } from './BubbleChip';
import { BubbleEnter } from './BubbleEnter';
import { RoundArrowButton } from './RoundArrowButton';
import { type BubbleOption } from '../data/onboardingOptions';
import {
  colors,
  fonts,
  headingClipFix,
  mutedColorForLabel,
  noFakeBold,
  spacing,
} from '../theme';
const ROW_GAP = 2;

type Props = {
  question: string;
  subtitle?: string;
  helperText?: string;
  options: readonly BubbleOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddCustom?: (value: string) => void;
  onSubmit: () => void;
  allowAdd?: boolean;
  addPlaceholder?: string;
};

type CloudChip = {
  key: string;
  align: 'flex-start' | 'flex-end' | 'center';
  nudge: number;
  node: ReactNode;
};

/** Pleasant chaos: left / right / soft center, never a centered column. */
const FALLBACK_ALIGN: Array<CloudChip['align']> = [
  'flex-start',
  'flex-end',
  'flex-start',
  'flex-end',
  'flex-start',
  'flex-end',
];

/**
 * One rhythm for every chip screen (matches the voice-tone layout):
 * left/right alternate, the same small inward nudges, the same row gap.
 */
const FALLBACK_NUDGE = [0, 0, 24, -12, 8, 0];

function toAlign(
  value: BubbleOption['align'] | undefined,
  index: number
): CloudChip['align'] {
  if (value === 'left') return 'flex-start';
  if (value === 'right') return 'flex-end';
  if (value === 'center') return 'center';
  return FALLBACK_ALIGN[index % FALLBACK_ALIGN.length]!;
}

export function ChipQuestionScreen({
  question,
  subtitle,
  helperText,
  options,
  selected,
  onToggle,
  onAddCustom,
  onSubmit,
  allowAdd = true,
  addPlaceholder = '',
}: Props) {
  const [custom, setCustom] = useState('');

  const canSubmit = selected.length > 0;
  const showCustomInput = allowAdd && Boolean(onAddCustom);

  const submitCustom = () => {
    const value = custom.trim();
    if (!value) return;
    onAddCustom?.(value);
    setCustom('');
  };

  const customOptions = selected.filter(
    (item) => !options.some((o) => o.label === item)
  );

  const cloudChips = useMemo(() => {
    const items: CloudChip[] = options.map((item, index) => ({
      key: item.label,
      // Per-option align/nudge ignored on purpose: identical spacing everywhere.
      align: toAlign(undefined, index),
      nudge: FALLBACK_NUDGE[index % FALLBACK_NUDGE.length]!,
      node: (
        <BubbleChip
          label={item.label}
          caption={item.caption}
          color={item.color}
          textColor={item.text}
          selected={selected.includes(item.label)}
          delay={Math.min(40 + index * 25, 180)}
          onPress={() => onToggle(item.label)}
        />
      ),
    }));

    customOptions.forEach((item, index) => {
      const i = options.length + index;
      items.push({
        key: `custom-${item}`,
        align: toAlign(undefined, i),
        nudge: FALLBACK_NUDGE[i % FALLBACK_NUDGE.length]!,
        node: (
          <BubbleChip
            label={item}
            color={mutedColorForLabel(item)}
            selected={selected.includes(item)}
            delay={40 + index * 50}
            onPress={() => onToggle(item)}
          />
        ),
      });
    });

    return items;
  }, [customOptions, onToggle, options, selected]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BubbleEnter delay={0} fromY={10}>
            <BackButton style={styles.backInScroll} />
          </BubbleEnter>
          {/* One enter block so heading + subtitle share the same left edge (no scale drift). */}
          <BubbleEnter delay={0} fromY={16}>
            <View style={styles.header}>
              <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.question}>{question}</Text>
              {subtitle ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </BubbleEnter>

          {showCustomInput ? (
            <View style={styles.addTop}>
              <View style={styles.addInputUnderline}>
                <TextInput maxFontSizeMultiplier={1.5}
                  value={custom}
                  onChangeText={setCustom}
                  placeholder={addPlaceholder}
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                  onSubmitEditing={submitCustom}
                  style={styles.addInput}
                  selectionColor={colors.text}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>
          ) : null}

          <View style={styles.chipWrap}>
            {cloudChips.map((item) => (
              <View
                key={item.key}
                style={[
                  styles.chipRow,
                  {
                    justifyContent: item.align,
                    transform: item.nudge ? [{ translateX: item.nudge }] : undefined,
                  },
                ]}
              >
                {item.node}
              </View>
            ))}
          </View>

          {helperText ? (
            <BubbleEnter delay={120} fromY={8}>
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.helper}>{helperText}</Text>
            </BubbleEnter>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <RoundArrowButton
            onPress={onSubmit}
            disabled={!canSubmit}
            color={colors.fab}
          />
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
  page: {
    paddingTop: spacing.webTop + spacing.screenTop,
    paddingBottom: 12,
    paddingHorizontal: spacing.inset,
    overflow: 'visible' as const,
  },
  backInScroll: {
    marginTop: 0,
  },
  header: {
    paddingBottom: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  question: {
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'left',
    marginBottom: 12,
    alignSelf: 'stretch',
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  addTop: {
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  chipWrap: {
    paddingHorizontal: 0,
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: ROW_GAP,
  },
  addInputUnderline: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  addInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    width: '100%',
    padding: 0,
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as object)
      : null),
  },
  helper: {
    marginTop: 12,
    paddingHorizontal: 0,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.inset,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'flex-end',
    backgroundColor: colors.bg,
  },
});

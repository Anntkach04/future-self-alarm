import { useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  mutedPalette,
  noFakeBold,
  noFakeLight,
  radii,
  spacing,
} from '../theme';

const CHIP_GAP = 8;
const ROW_GAP = 10;

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
  /** Show text input always open at the top (above chips), never collapsed to + */
  inputAlwaysVisible?: boolean;
};

type CloudChip = {
  key: string;
  widthHint: number;
  nudgeRight?: number;
  node: ReactNode;
};

function estimateChipWidth(label: string, plus?: boolean) {
  if (plus) return 48;
  return 36 + Math.ceil(label.length * 8.2);
}

function packChipRows(items: CloudChip[], maxWidth: number): CloudChip[][] {
  if (maxWidth <= 0) return [items];
  const rows: CloudChip[][] = [];
  let row: CloudChip[] = [];
  let used = 0;
  for (const item of items) {
    const width = Math.min(item.widthHint, maxWidth);
    const next = row.length === 0 ? width : used + CHIP_GAP + width;
    if (row.length > 0 && next > maxWidth) {
      rows.push(row);
      row = [item];
      used = width;
    } else {
      row.push(item);
      used = next;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

function rowJustify(
  row: CloudChip[],
  rowIndex: number,
  maxWidth: number
): 'flex-start' | 'flex-end' | 'center' {
  if (row.length > 1) return 'center';
  const width = Math.min(row[0]?.widthHint ?? 0, maxWidth);
  if (width > maxWidth * 0.72) return 'center';
  const pattern = ['flex-start', 'flex-end', 'center'] as const;
  return pattern[rowIndex % pattern.length];
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
  inputAlwaysVisible = false,
}: Props) {
  const [adding, setAdding] = useState(inputAlwaysVisible);
  const [custom, setCustom] = useState('');
  const window = useWindowDimensions();
  const [wrapW, setWrapW] = useState(() =>
    Math.max(0, window.width - spacing.inset * 2)
  );

  const canSubmit = selected.length > 0;

  const submitCustom = () => {
    const value = custom.trim();
    if (!value) {
      if (!inputAlwaysVisible) setAdding(false);
      return;
    }
    onAddCustom?.(value);
    setCustom('');
    if (!inputAlwaysVisible) setAdding(false);
  };

  const customOptions = selected.filter(
    (item) => !options.some((o) => o.label === item)
  );

  const cloudChips = useMemo(() => {
    const items: CloudChip[] = options.map((item, index) => ({
      key: item.label,
      widthHint: estimateChipWidth(item.label),
      nudgeRight: item.nudgeRight,
      node: (
        <BubbleChip
          label={item.label}
          caption={item.caption}
          color={item.color}
          textColor={item.text}
          selected={selected.includes(item.label)}
          delay={80 + index * 55}
          onPress={() => onToggle(item.label)}
        />
      ),
    }));

    customOptions.forEach((item, index) => {
      items.push({
        key: `custom-${item}`,
        widthHint: estimateChipWidth(item),
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
  }, [
    customOptions,
    onToggle,
    options,
    selected,
  ]);

  const rows = packChipRows(cloudChips, wrapW);

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
          <BackButton style={styles.backInScroll} />
          <View style={styles.header}>
            <BubbleEnter delay={0} fromY={16}>
              <Text style={styles.question}>{question}</Text>
            </BubbleEnter>
            {subtitle ? (
              <BubbleEnter delay={50} fromY={12}>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </BubbleEnter>
            ) : null}
          </View>

          {allowAdd && onAddCustom ? (
            <View style={styles.addTop}>
              {inputAlwaysVisible ? (
                <View style={styles.addInputUnderline}>
                  <TextInput
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
              ) : adding ? (
                <View style={[styles.addInputWrap, { backgroundColor: mutedPalette[7] }]}>
                  <TextInput
                    value={custom}
                    onChangeText={setCustom}
                    autoFocus
                    placeholder={addPlaceholder}
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="done"
                    onSubmitEditing={submitCustom}
                    onBlur={submitCustom}
                    style={styles.addInput}
                    selectionColor={colors.text}
                    underlineColorAndroid="transparent"
                  />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Write your own"
                  onPress={() => setAdding(true)}
                  hitSlop={12}
                  style={styles.hiddenPlus}
                >
                  <Text style={styles.hiddenPlusMark}>+</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View
            style={styles.chipWrap}
            onLayout={(e) => {
              const width = Math.round(e.nativeEvent.layout.width);
              if (width > 0 && width !== wrapW) setWrapW(width);
            }}
          >
            {rows.map((row, rowIndex) => (
              <View
                key={row.map((item) => item.key).join('|')}
                style={[
                  styles.chipRow,
                  { justifyContent: rowJustify(row, rowIndex, wrapW) },
                ]}
              >
                {row.map((item) => (
                  <View
                    key={item.key}
                    style={
                      item.nudgeRight
                        ? { transform: [{ translateX: item.nudgeRight }] }
                        : undefined
                    }
                  >
                    {item.node}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {helperText ? (
            <BubbleEnter delay={120} fromY={8}>
              <Text style={styles.helper}>{helperText}</Text>
            </BubbleEnter>
          ) : null}

          <View style={styles.nextWrap}>
            <RoundArrowButton
              onPress={onSubmit}
              disabled={!canSubmit}
              color={colors.fab}
            />
          </View>
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
  page: {
    flexGrow: 1,
    paddingTop: spacing.webTop,
    paddingBottom: spacing.inset,
    paddingHorizontal: spacing.inset,
    overflow: 'visible' as const,
  },
  backInScroll: {
    marginTop: 0,
  },
  header: {
    paddingBottom: 24,
  },
  question: {
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'left',
    marginBottom: 16,
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    fontFamily: fonts.bodyLight,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
    ...(Platform.OS === 'web'
      ? ({ fontWeight: '300', fontSynthesis: 'none' } as object)
      : { fontWeight: '300' as const }),
  },
  addTop: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  hiddenPlus: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.28,
  },
  hiddenPlusMark: {
    fontFamily: fonts.bodyLight,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    ...noFakeLight,
  },
  chipWrap: {
    paddingHorizontal: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: CHIP_GAP,
    width: '100%',
    marginBottom: ROW_GAP,
  },
  addInputUnderline: {
    width: '100%',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  addInputWrap: {
    minWidth: 180,
    width: '100%',
    maxWidth: '100%',
    borderRadius: radii.chip,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0,
    justifyContent: 'center',
  },
  addInput: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.text,
    minWidth: 160,
    padding: 0,
    borderWidth: 0,
    ...noFakeLight,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as object)
      : null),
  },
  helper: {
    marginTop: 16,
    paddingHorizontal: 0,
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  nextWrap: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 0,
    paddingTop: 32,
  },
});

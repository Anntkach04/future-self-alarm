import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chipMetrics, colors, fonts, mutedColorForLabel } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = {
  items: string[];
  /** Keep original casing (names). Habit/goal chips stay lowercase. */
  keepCase?: boolean;
  /** Optional fixed colors per item (from onboarding options). */
  colors?: string[];
  onPress?: () => void;
  /** Shown when there are no items (default "-"). */
  emptyLabel?: string;
};

export function RecapPills({ items, colors: itemColors, onPress, emptyLabel = '-', keepCase = false }: Props) {
  if (!items.length) {
    return <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.empty}>{emptyLabel}</Text>;
  }

  const content = (
    <View style={styles.pills}>
      {items.map((item, index) => (
        <View
          key={item}
          style={[
            styles.pill,
            {
              backgroundColor:
                itemColors?.[index] ?? mutedColorForLabel(item),
            },
          ]}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.pillText}>{keepCase ? item.trim() : uiLabel(item)}</Text>
        </View>
      ))}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  // Same chip as the onboarding questions (theme chipMetrics).
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: chipMetrics.rowGap,
    columnGap: chipMetrics.columnGap,
    marginBottom: 8,
  },
  pill: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: chipMetrics.paddingHorizontal,
    paddingVertical: chipMetrics.paddingVertical,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: chipMetrics.fontSize,
    lineHeight: chipMetrics.lineHeight,
    color: colors.text,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 8,
  },
});

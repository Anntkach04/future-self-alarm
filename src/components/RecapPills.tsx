import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mutedColorForLabel } from '../theme';
import { fonts } from '../theme';
import { colors } from '../theme';
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
});

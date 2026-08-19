import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mutedColorForLabel } from '../theme';
import { fonts, noFakeLight } from '../theme';
import { colors } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = {
  items: string[];
  /** Optional fixed colors per item (from onboarding options). */
  colors?: string[];
  onPress?: () => void;
};

export function RecapPills({ items, colors: itemColors, onPress }: Props) {
  if (!items.length) {
    return <Text style={styles.empty}>-</Text>;
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
          <Text style={styles.pillText}>{uiLabel(item)}</Text>
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
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.text,
    ...noFakeLight,
  },
  empty: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
    ...noFakeLight,
  },
});

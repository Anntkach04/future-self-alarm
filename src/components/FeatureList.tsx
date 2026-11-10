import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, noFakeBold } from '../theme';

export type FeatureIcon = 'voice' | 'alarm' | 'heart' | 'bell' | 'lock';

const INK = colors.text;

function Icon({ name }: { name: FeatureIcon }) {
  const common = {
    stroke: INK,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  switch (name) {
    case 'voice':
      return (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path d="M3 9v4M7 6v10M11 3v16M15 6v10M19 9v4" {...common} />
        </Svg>
      );
    case 'alarm':
      return (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Circle cx={11} cy={12} r={7} {...common} />
          <Path d="M11 8.5V12l2.5 1.5M3.5 5 6 2.8M18.5 5 16 2.8" {...common} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path
            d="M11 18.5s-7-4.2-7-9.2A3.8 3.8 0 0 1 11 7.2a3.8 3.8 0 0 1 7 2.1c0 5-7 9.2-7 9.2Z"
            {...common}
          />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path
            d="M5.5 15.5V10a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H4l1.5-1.5ZM9 19a2 2 0 0 0 4 0"
            {...common}
          />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path d="M5 10h12v8H5zM7.5 10V7.5a3.5 3.5 0 0 1 7 0V10" {...common} />
        </Svg>
      );
  }
}

function Check() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M3 7.5 5.8 10 11 4"
        stroke={colors.bg}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export type FeatureItem = {
  icon: FeatureIcon;
  title: string;
  body: string;
  /** Shows a check badge (e.g. permission granted). */
  done?: boolean;
  /** Small action on the right (e.g. "turn on" when a permission is off). */
  action?: { label: string; onPress: () => void };
};

type Props = {
  items: FeatureItem[];
  /** Card background — one of the bright accents. */
  color: string;
};

/**
 * Value list on a colored card: icon tile, title, one line of detail.
 * Used where a screen has to say what the user gets (sign in, permissions).
 */
export function FeatureList({ items, color }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      {items.map((item, i) => (
        <View
          key={item.title}
          style={[styles.row, i > 0 && styles.rowDivider]}
          accessible
          accessibilityLabel={`${item.title}. ${item.body}${item.done ? '. On' : ''}`}
        >
          <View style={styles.tile}>
            <Icon name={item.icon} />
            {item.done ? (
              <View style={styles.badge}>
                <Check />
              </View>
            ) : null}
          </View>
          <View style={styles.copy}>
            <Text maxFontSizeMultiplier={1.3} style={styles.title}>
              {item.title}
            </Text>
            <Text
              maxFontSizeMultiplier={1.5}
              lineBreakStrategyIOS="push-out"
              style={styles.body}
            >
              {item.body}
            </Text>
          </View>
          {item.action ? (
            <Pressable
              accessibilityRole="button"
              onPress={item.action.onPress}
              hitSlop={8}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
            >
              <Text maxFontSizeMultiplier={1.3} style={styles.actionText}>
                {item.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 26, 26, 0.15)',
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 250, 238, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 28,
    color: INK,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
    opacity: 0.8,
  },
  action: {
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.bg,
  },
});

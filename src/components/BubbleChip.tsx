import { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, fonts, noFakeLight, radii } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = {
  label?: string;
  color: string;
  textColor?: string;
  caption?: string;
  selected?: boolean;
  onPress: () => void;
  delay?: number;
  style?: ViewStyle;
  plus?: boolean;
};

/** Visible immediately. Enter rise is motion-only, so text size and gaps stay even. */
export function BubbleChip({
  label = '',
  color,
  textColor = colors.text,
  caption,
  selected,
  onPress,
  delay = 0,
  style,
  plus = false,
}: Props) {
  const rise = useRef(new Animated.Value(14)).current;
  const startDelay = Math.min(Math.max(delay, 0), 160);

  useEffect(() => {
    rise.setValue(14);

    const enter = Animated.sequence([
      Animated.delay(startDelay),
      Animated.spring(rise, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]);

    const failsafe = setTimeout(() => {
      rise.setValue(0);
    }, startDelay + 500);

    enter.start(({ finished }) => {
      if (finished) rise.setValue(0);
    });

    return () => {
      clearTimeout(failsafe);
      enter.stop();
      rise.setValue(0);
    };
  }, [rise, startDelay]);

  return (
    <Pressable onPress={onPress} style={[styles.hit, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.chip,
          plus && styles.plusChip,
          {
            backgroundColor: selected ? colors.text : color,
            opacity: 1,
            transform: [{ translateY: rise }],
          },
        ]}
      >
        {plus ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out"
            style={[
              styles.plus,
              { color: selected ? colors.bg : textColor },
            ]}
          >
            +
          </Text>
        ) : (
          <Text maxFontSizeMultiplier={1} lineBreakStrategyIOS="push-out"
            numberOfLines={1}
            style={[
              styles.label,
              { color: selected ? colors.bg : textColor },
            ]}
          >
            {uiLabel(label)}
          </Text>
        )}
        {caption ? (
          <Text maxFontSizeMultiplier={1} lineBreakStrategyIOS="push-out"
            style={[
              styles.caption,
              { color: selected ? colors.bg : textColor },
            ]}
          >
            {uiLabel(caption)}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    maxWidth: '100%',
  },
  chip: {
    borderRadius: radii.chip,
    // Same density on every chip screen (goals / habits / tone / …).
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0,
    alignSelf: 'flex-start',
    flexShrink: 0,
    maxWidth: '100%',
  },
  plusChip: {
    width: 48,
    height: 48,
    minWidth: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 20,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({ whiteSpace: 'nowrap' } as object)
      : null),
  },
  plus: {
    fontFamily: fonts.bodyLight,
    fontSize: 28,
    lineHeight: 30,
    ...noFakeLight,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 20,
    marginTop: 4,
  },
});

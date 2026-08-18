import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
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

/**
 * Bubble pop: tiny → overshoot spring → soft idle float.
 * Pass increasing `delay` per chip so they appear one by one.
 */
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
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const enter = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5.2,
          tension: 128,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(rise, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
    ]);

    enter.start(({ finished }) => {
      if (!finished) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration: 2400 + (delay % 400),
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: 2400 + (delay % 400),
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    return () => {
      enter.stop();
    };
  }, [delay, float, opacity, rise, scale]);

  const floatY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <Pressable
      onPress={onPress}
      style={[styles.hit, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.chip,
          plus && styles.plusChip,
          {
            backgroundColor: selected ? colors.text : color,
            opacity,
            transform: [
              { translateY: Animated.add(rise, floatY) },
              { scale },
            ],
          },
        ]}
      >
        {plus ? (
          <Text
            style={[
              styles.plus,
              { color: selected ? colors.bg : textColor },
            ]}
          >
            +
          </Text>
        ) : (
          <Text
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
          <Text
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
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({ whiteSpace: 'nowrap' } as object)
      : null),
    ...noFakeLight,
  },
  plus: {
    fontFamily: fonts.bodyLight,
    fontSize: 28,
    lineHeight: 30,
    ...noFakeLight,
  },
  caption: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
    ...noFakeLight,
  },
});

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
import { chipMetrics, colors, fonts, noFakeLight, radii } from '../theme';
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

const FLOAT_MS = 2400;

/**
 * One bob for every chip on screen. Each chip used to start its own loop
 * after its own entrance (staggered), so rows drifted out of phase and the
 * vertical gap between them kept changing. Shared value = constant gap.
 */
const SHARED_FLOAT = new Animated.Value(0);
let floatUsers = 0;
let sharedLoop: Animated.CompositeAnimation | null = null;

function acquireSharedFloat() {
  floatUsers += 1;
  if (!sharedLoop) {
    sharedLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(SHARED_FLOAT, {
          toValue: 1,
          duration: FLOAT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(SHARED_FLOAT, {
          toValue: 0,
          duration: FLOAT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    sharedLoop.start();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    floatUsers = Math.max(0, floatUsers - 1);
    if (floatUsers === 0 && sharedLoop) {
      sharedLoop.stop();
      sharedLoop = null;
      SHARED_FLOAT.setValue(0);
    }
  };
}

/** Visible immediately; spring + float are motion-only (opacity always 1). */
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
  const scale = useRef(new Animated.Value(0.86)).current;
  const rise = useRef(new Animated.Value(14)).current;
  const float = SHARED_FLOAT;
  const startDelay = Math.min(Math.max(delay, 0), 160);
  const floatLoop = useRef<(() => void) | null>(null);

  useEffect(() => {
    scale.setValue(0.86);
    rise.setValue(14);

    const enter = Animated.sequence([
      Animated.delay(startDelay),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5.2,
          tension: 128,
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

    const failsafe = setTimeout(() => {
      scale.setValue(1);
      rise.setValue(0);
    }, startDelay + 500);

    enter.start(({ finished }) => {
      if (!finished) return;
      scale.setValue(1);
      rise.setValue(0);
      floatLoop.current = acquireSharedFloat();
    });

    return () => {
      clearTimeout(failsafe);
      enter.stop();
      floatLoop.current?.();
      floatLoop.current = null;
      scale.setValue(1);
      rise.setValue(0);
    };
  }, [float, rise, scale, startDelay]);

  const floatY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

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
            transform: [
              { translateY: Animated.add(rise, floatY) },
              { scale },
            ],
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
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out"
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
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out"
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
    paddingHorizontal: chipMetrics.paddingHorizontal,
    paddingVertical: chipMetrics.paddingVertical,
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
    fontSize: chipMetrics.fontSize,
    lineHeight: chipMetrics.lineHeight,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({ whiteSpace: 'nowrap' } as object)
      : null),
  },
  plus: {
    fontFamily: fonts.bodyLight,
    fontSize: 28,
    lineHeight: 32,
    ...noFakeLight,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.8,
    marginTop: 4,
  },
});

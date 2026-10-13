import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  fromY?: number;
  fromScale?: number;
};

/**
 * Motion only — opacity stays 1 forever.
 * Stalled springs must never hide fields/buttons.
 */
export function BubbleEnter({
  children,
  delay = 0,
  style,
  fromY = 16,
  fromScale = 0.92,
}: Props) {
  const translateY = useRef(new Animated.Value(fromY)).current;
  const scale = useRef(new Animated.Value(fromScale)).current;
  const startDelay = Math.min(Math.max(delay, 0), 120);

  useEffect(() => {
    translateY.setValue(fromY);
    scale.setValue(fromScale);

    const enter = Animated.sequence([
      Animated.delay(startDelay),
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5.2,
          tension: 128,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const failsafe = setTimeout(() => {
      translateY.setValue(0);
      scale.setValue(1);
    }, startDelay + 500);

    enter.start(({ finished }) => {
      if (finished) {
        translateY.setValue(0);
        scale.setValue(1);
      }
    });

    return () => {
      clearTimeout(failsafe);
      enter.stop();
      translateY.setValue(0);
      scale.setValue(1);
    };
  }, [fromScale, fromY, scale, startDelay, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        style,
        {
          opacity: 1,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

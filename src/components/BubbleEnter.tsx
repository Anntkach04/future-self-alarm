import { ReactNode, useEffect, useRef, useState } from 'react';
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
  /**
   * Delayed items (the input pill) used to stay at fromScale — 92% and off
   * the text column — when the JS-timer delay never fired. Once the entrance
   * is over the transform is dropped entirely.
   */
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    translateY.setValue(fromY);
    scale.setValue(fromScale);
    setSettled(false);

    // Delay as a native no-op timing (not Animated.delay / spring `delay`,
    // which wait on a JS timer). Springs then chain on the native end event.
    const hold = new Animated.Value(0);
    const springs = Animated.parallel([
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
    ]);
    const enter =
      startDelay > 0
        ? Animated.sequence([
            Animated.timing(hold, {
              toValue: 1,
              duration: startDelay,
              useNativeDriver: true,
            }),
            springs,
          ])
        : springs;

    const failsafe = setTimeout(() => {
      translateY.setValue(0);
      scale.setValue(1);
      setSettled(true);
    }, startDelay + 700);

    enter.start(({ finished }) => {
      if (finished) {
        translateY.setValue(0);
        scale.setValue(1);
        setSettled(true);
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
        settled
          ? null
          : {
              opacity: 1,
              transform: [{ translateY }, { scale }],
            },
      ]}
    >
      {children}
    </Animated.View>
  );
}

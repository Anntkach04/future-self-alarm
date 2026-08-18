import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  fromY?: number;
  fromScale?: number;
};

/** Bubble pop: fade + overshoot spring — used on every onboarding element. */
export function BubbleEnter({
  children,
  delay = 0,
  style,
  fromY = 16,
  fromScale = 0.9,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  const scale = useRef(new Animated.Value(fromScale)).current;

  useEffect(() => {
    const enter = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
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
    enter.start();
    return () => enter.stop();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

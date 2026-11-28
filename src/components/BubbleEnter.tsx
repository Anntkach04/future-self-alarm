import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  fromY?: number;
  /** @deprecated no scale any more; ignored. */
  fromScale?: number;
};

/**
 * Gentle entrance: a soft fade with a small rise, no spring and no scale
 * (the bouncy version felt jumpy between screens). Chips keep their own
 * bubble pop (BubbleChip).
 * A failsafe drops the animated style, so a stalled animation can never
 * leave fields or buttons hidden.
 */
export function BubbleEnter({
  children,
  delay = 0,
  style,
  fromY = 16,
}: Props) {
  // Half the old travel: the rise should be felt, not seen.
  const startY = Math.round(fromY * 0.5);
  const translateY = useRef(new Animated.Value(startY)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const startDelay = Math.min(Math.max(delay, 0), 120);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    translateY.setValue(startY);
    opacity.setValue(0);
    setSettled(false);

    const easing = Easing.bezier(0.22, 1, 0.36, 1);
    const enter = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 360,
        delay: startDelay,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: startDelay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const settle = () => {
      translateY.setValue(0);
      opacity.setValue(1);
      setSettled(true);
    };
    const failsafe = setTimeout(settle, startDelay + 600);
    enter.start(({ finished }) => {
      if (finished) settle();
    });

    return () => {
      clearTimeout(failsafe);
      enter.stop();
      translateY.setValue(0);
      opacity.setValue(1);
    };
  }, [opacity, startDelay, startY, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[style, settled ? null : { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

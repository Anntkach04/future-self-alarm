import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

const LOGO = require('../../assets/illustrations/logo-mark.png');
const SIZE = 48;
const SPIN_MS = 1400;
const KEYFRAMES_ID = 'fsa-logo-spin-kf';

type Props = {
  size?: number;
  style?: ViewStyle;
};

function ensureWebSpinCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const tag = document.createElement('style');
  tag.id = KEYFRAMES_ID;
  tag.textContent = `
@keyframes fsaLogoSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.fsa-logo-spin {
  animation: fsaLogoSpin ${SPIN_MS}ms linear infinite !important;
  transform-origin: 50% 50%;
}
`;
  document.head.appendChild(tag);
}

/** Brand mark that spins until unmounted — including while the splash retracts. */
export function LogoSpinner({ size = SIZE, style }: Props) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      ensureWebSpinCss();
      return;
    }

    rotate.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (Platform.OS === 'web') {
    ensureWebSpinCss();
    return (
      <View
        collapsable={false}
        {...({
          className: 'fsa-logo-spin',
        } as object)}
        style={[
          styles.wrap,
          { width: size, height: size },
          {
            animationName: 'fsaLogoSpin',
            animationDuration: `${SPIN_MS}ms`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          } as object,
          style,
        ]}
      >
        <Image
          source={LOGO}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityLabel="Loading"
        />
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size },
        { transform: [{ rotate: spin }] },
        style,
      ]}
    >
      <Image
        source={LOGO}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Loading"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

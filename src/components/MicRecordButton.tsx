import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { brightPalette, colors } from '../theme';

type Props = {
  recording: boolean;
  onPress: () => void;
};

const IDLE = brightPalette[2];
const RECORDING = brightPalette[6];

/** Crisp vector mic — larger viewBox, no tiny bitmap scaling. */
function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={36} height={36} viewBox="0 0 48 48" fill="none">
      <Rect x="18" y="6" width="12" height="22" rx="6" fill={color} />
      <Path
        d="M14 22c0 5.523 4.477 10 10 10s10-4.477 10-10"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Path
        d="M24 32v8"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Path
        d="M18 40h12"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MicRecordButton({ recording, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      pulse.setValue(0);
      scale.setValue(1);
      return;
    }

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const rings = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    breathe.start();
    rings.start();
    return () => {
      breathe.stop();
      rings.stop();
      pulse.setValue(0);
    };
  }, [pulse, recording, scale]);

  const ringStyle = (delay: number) => ({
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35 - delay * 0.1, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.55 + delay * 0.2],
        }),
      },
    ],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      style={styles.hit}
    >
      {recording ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: RECORDING }, ringStyle(0)]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: IDLE }, ringStyle(0.35)]}
          />
        </>
      ) : null}
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: recording ? RECORDING : IDLE },
          { transform: [{ scale }] },
        ]}
      >
        <MicIcon color={colors.text} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 999,
  },
  button: {
    width: 78,
    height: 78,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { brightPalette, mutedPalette } from '../theme';

type Props = {
  active: boolean;
  /** Kept for API compatibility; the animation does not follow meter ticks. */
  metering?: number;
  hearing?: boolean;
};

const BAR_COUNT = 11;
const BAR_MAX = 76;
const WAVE_COLORS = [
  mutedPalette[6],
  brightPalette[1],
  brightPalette[2],
  mutedPalette[0],
  brightPalette[7],
  mutedPalette[1],
  brightPalette[3],
  mutedPalette[5],
  brightPalette[8],
  mutedPalette[3],
  brightPalette[5],
];

/**
 * Lightweight waveform on the native driver: bars scale (transform) instead
 * of animating height, so nothing runs on the JS thread. The old JS-driven
 * height loops ran 11 animations at 60 fps on the same thread that handles
 * speech recognition, which made recording lag and freeze.
 */
export function LiveWaveform({ active, hearing = false }: Props) {
  const phases = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;
  // How tall the bars swing: louder while speech is heard. Native-driven too.
  const energy = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.timing(energy, {
      toValue: active ? (hearing ? 1 : 0.55) : 0.2,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, energy, hearing]);

  useEffect(() => {
    const animations = phases.map((phase, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(phase, {
            toValue: 1,
            duration: 380 + i * 35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(phase, {
            toValue: 0,
            duration: 380 + i * 35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    if (active) {
      animations.forEach((anim) => anim.start());
    } else {
      animations.forEach((anim) => anim.stop());
      phases.forEach((phase) => phase.setValue(0.15));
    }
    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [active, phases]);

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel="Voice waveform"
    >
      {phases.map((phase, i) => {
        const min = (12 + (i % 3) * 2) / BAR_MAX;
        // scale = min + phase * (reach - min), reach = (18 + 58 * energy) / BAR_MAX
        const reach = Animated.add(18 / BAR_MAX, Animated.multiply(energy, 58 / BAR_MAX));
        const scaleY = Animated.add(
          min,
          Animated.multiply(phase, Animated.subtract(reach, min))
        );
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: WAVE_COLORS[i % WAVE_COLORS.length],
                opacity: active ? 1 : 0.45,
                transform: [{ scaleY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bar: {
    width: 5,
    height: BAR_MAX,
    borderRadius: 999,
  },
});

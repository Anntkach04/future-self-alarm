import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { brightPalette, mutedPalette } from '../theme';

type Props = {
  active: boolean;
  /** Kept for API compatibility; animation no longer depends on every meter tick. */
  metering?: number;
  hearing?: boolean;
};

const BAR_COUNT = 11;
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
 * Lightweight waveform — Animated only, no setState every frame.
 * (React state + metering updates was freezing the dictaphone UI.)
 */
export function LiveWaveform({ active, hearing = false }: Props) {
  const phases = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = phases.map((phase, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(phase, {
            toValue: 1,
            duration: 380 + i * 35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(phase, {
            toValue: 0,
            duration: 380 + i * 35,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
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

  const energy = active ? (hearing ? 1 : 0.55) : 0.2;

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel="Voice waveform"
    >
      {phases.map((phase, i) => {
        const height = phase.interpolate({
          inputRange: [0, 1],
          outputRange: [12 + (i % 3) * 2, 18 + 58 * energy],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: WAVE_COLORS[i % WAVE_COLORS.length],
                opacity: active ? 1 : 0.45,
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
    gap: 6,
  },
  bar: {
    width: 5,
    borderRadius: 999,
  },
});

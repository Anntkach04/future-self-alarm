import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { brightPalette, mutedPalette } from '../theme';

type Props = {
  active: boolean;
  metering: number;
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

export function LiveWaveform({ active, metering, hearing = false }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [active]);

  const heights = useMemo(() => {
    const fromMeter = active ? Math.min(1, Math.max(0, (metering + 48) / 42)) : 0;
    const energy = active ? Math.max(fromMeter, hearing ? 0.55 : 0.18) : 0.12;

    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const wave = Math.sin((i * 0.72 + tick * 0.38) * 1.15) * 0.5 + 0.5;
      const bounce = Math.sin((tick + i * 3) * 0.55) * 0.25 + 0.75;
      const quiet = 14 + i % 4;
      return Math.max(quiet, 24 + 62 * energy * wave * bounce);
    });
  }, [active, hearing, metering, tick]);

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Voice waveform">
      {heights.map((h, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: h,
              backgroundColor: WAVE_COLORS[i % WAVE_COLORS.length],
              opacity: active ? 1 : 0.45,
            },
          ]}
        />
      ))}
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

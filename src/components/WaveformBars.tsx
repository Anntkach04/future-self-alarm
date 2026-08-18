import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  active: boolean;
  metering: number;
};

const BAR_COUNT = 24;

export function WaveformBars({ active, metering }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, [active]);

  const heights = useMemo(() => {
    const normalized = active
      ? Math.min(1, Math.max(0.15, (metering + 50) / 50))
      : 0.2;

    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const wave = Math.sin((i + tick) * 0.45) * 0.35 + 0.65;
      const jitter = active ? ((i * 17 + tick * 13) % 7) / 20 : 0.15;
      return Math.max(8, 48 * normalized * wave * (0.7 + jitter));
    });
  }, [active, metering, tick]);

  return (
    <View style={styles.row}>
      {heights.map((h, i) => (
        <View key={i} style={[styles.bar, { height: h }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 999,
    backgroundColor: colors.text,
    opacity: 0.85,
  },
});

import { Pressable, StyleSheet, View } from 'react-native';

function idleTint(hex: string) {
  return `${hex}55`;
}

type Props = {
  index: number;
  colors: readonly string[];
  onPress?: (index: number) => void;
};

export function OnboardingProgress({ index, colors, onPress }: Props) {
  const current = colors[index] ?? colors[0] ?? '#FEC554';

  return (
    <View style={styles.row}>
      {colors.map((color, i) => (
        <Pressable
          key={`${color}-${i}`}
          onPress={() => onPress?.(i)}
          disabled={!onPress}
          hitSlop={8}
          style={styles.hit}
        >
          <View
            style={[
              styles.bar,
              {
                backgroundColor: i <= index ? current : idleTint(color),
              },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  hit: {
    flex: 1,
  },
  bar: {
    height: 6,
    borderRadius: 999,
    width: '100%',
  },
});

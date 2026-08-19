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
  return (
    <View style={styles.row}>
      {colors.map((color, i) => {
        const reached = i <= index;
        const active = i === index;
        return (
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
                active && styles.barActive,
                {
                  backgroundColor: reached ? color : idleTint(color),
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minHeight: 10,
  },
  hit: {
    flex: 1,
  },
  bar: {
    height: 6,
    borderRadius: 999,
    width: '100%',
  },
  barActive: {
    height: 10,
  },
});

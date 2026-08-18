import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { ForwardArrow } from './ForwardArrow';
import { accents, radii, colors } from '../theme';

type PressState = { pressed: boolean; hovered?: boolean };

type Props = {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  color?: string;
};

export function RoundArrowButton({
  onPress,
  disabled,
  style,
  color = accents.gold,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {({ pressed, hovered }: PressState) => (
        <ForwardArrow
          lifted={!disabled && Boolean(pressed || hovered)}
          color={colors.arrow}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.7,
  },
});

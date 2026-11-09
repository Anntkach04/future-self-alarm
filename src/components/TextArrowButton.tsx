import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { ForwardArrow } from './ForwardArrow';
import { colors, fonts, noFakeBold, radii } from '../theme';
import { uiLabel } from '../utils/labels';

type PressState = { pressed: boolean; hovered?: boolean };

type Props = {
  label: string;
  onPress: () => void;
  color: string;
  textColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
  /** Same pill style without the arrow (e.g. karaoke Continue). */
  hideArrow?: boolean;
  /** The screen's main action: full width, taller, centered. */
  wide?: boolean;
};

export function TextArrowButton({
  label,
  onPress,
  color,
  textColor = colors.text,
  style,
  disabled = false,
  hideArrow = false,
  wide = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        styles.btn,
        hideArrow && styles.btnNoArrow,
        wide && styles.wide,
        { backgroundColor: color },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ pressed, hovered }: PressState) => (
        <>
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={[styles.label, wide && styles.labelWide, { color: textColor }]}>{uiLabel(label)}</Text>
          {hideArrow ? null : (
            <ForwardArrow lifted={Boolean(pressed || hovered)} color={textColor} />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 8,
    // Apple minimum touch target.
    minHeight: 44,
    borderRadius: radii.button,
  },
  wide: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 52,
  },
  labelWide: {
    fontSize: 19,
    lineHeight: 23,
  },
  btnNoArrow: {
    paddingHorizontal: 18,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 21,
    ...noFakeBold,
  },
});

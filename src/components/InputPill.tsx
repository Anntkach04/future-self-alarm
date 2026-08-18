import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { ForwardArrow } from './ForwardArrow';
import { accents, colors, fonts, noFakeLight } from '../theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoFocus?: boolean;
  buttonColor?: string;
  style?: ViewStyle;
};

/**
 * Single Figma pill: input + nested 56px circle with ↗ arrow.
 */
export function InputPill({
  value,
  onChangeText,
  onSubmit,
  placeholder = '',
  keyboardType = 'default',
  autoFocus = true,
  buttonColor = accents.gold,
  style,
}: Props) {
  const canSubmit = value.trim().length > 0;

  return (
    <View style={[styles.pill, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        returnKeyType="next"
        underlineColorAndroid="transparent"
        selectionColor={colors.text}
        onSubmitEditing={() => {
          if (canSubmit) onSubmit();
        }}
        style={styles.input}
      />

      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={!canSubmit}
        hitSlop={0}
        style={({ pressed }) => [
          styles.arrowButton,
          { backgroundColor: buttonColor },
          pressed && canSubmit && styles.arrowPressed,
          !canSubmit && styles.arrowDisabled,
        ]}
      >
        {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
          <View pointerEvents="none" style={styles.iconWrap}>
            <ForwardArrow
              lifted={canSubmit && Boolean(pressed || hovered)}
              color={colors.arrow}
            />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'relative',
    alignSelf: 'center',
    width: 333,
    maxWidth: '100%',
    height: 60,
    borderWidth: 2,
    borderColor: colors.stroke,
    borderRadius: 36,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  input: {
    ...StyleSheet.absoluteFill,
    paddingLeft: 20,
    paddingRight: 72,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: fonts.bodyLight,
    fontSize: 17,
    color: colors.text,
    ...noFakeLight,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as object)
      : null),
  },
  arrowButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 2,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowPressed: {
    opacity: 0.85,
  },
  /** Dim circle only slightly — keep arrow readable like Figma */
  arrowDisabled: {
    opacity: 0.7,
  },
});

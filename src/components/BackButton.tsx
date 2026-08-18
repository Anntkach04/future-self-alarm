import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { ArrowUpLeftIcon } from './ArrowUpLeftIcon';
import { spacing } from '../theme';

export const BACK_SIZE = 28;
export const BACK_INSET = spacing.inset;

/** Top padding for screens without a back button (e.g. Home). */
export const PAGE_TOP = BACK_INSET;

type Props = {
  onPress?: () => void;
  style?: ViewStyle;
};

/** 28px ← in normal layout flow — scrolls with the page, never sticky. */
export function BackButton({ onPress, style }: Props) {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  if (!onPress && !canGoBack) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        navigation.goBack();
      }}
      style={({ pressed }) => [
        styles.hit,
        style,
        pressed && styles.pressed,
      ]}
    >
      <ArrowUpLeftIcon size={BACK_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: BACK_INSET,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
});

/** @deprecated use PAGE_TOP — kept so older imports still compile. */
export const BACK_CONTENT_TOP = PAGE_TOP;

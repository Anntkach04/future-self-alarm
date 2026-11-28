import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { ArrowUpLeftIcon } from './ArrowUpLeftIcon';
import { spacing } from '../theme';

export const BACK_SIZE = 28;
/** Same 40 pt box as Home's menu icon and the menu's ×, so all three sit on one line. */
export const BACK_BOX = 40;
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
    width: BACK_BOX,
    height: BACK_BOX,
    // Icon flush left like the menu icon; box only adds height + tap area.
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
});

/** @deprecated use PAGE_TOP — kept so older imports still compile. */
export const BACK_CONTENT_TOP = PAGE_TOP;

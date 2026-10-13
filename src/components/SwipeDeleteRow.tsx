import { ReactNode, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

const ACTION_W = 72;
const OPEN_THRESHOLD = 44;
const CIRCLE = 48;

type Props = {
  children: ReactNode;
  onDelete: () => void;
  onPress?: () => void;
  deleteLabel?: string;
  /** Matches the row surface so the swipe doesn’t flash the wrong fill. */
  surfaceColor?: string;
};

function TrashIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3.75h6M4.5 6.75h15M18.75 6.75l-.7 12.05a1.5 1.5 0 0 1-1.5 1.45H7.45a1.5 1.5 0 0 1-1.5-1.45L5.25 6.75M10.2 10.5v6M13.8 10.5v6"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Clock-style swipe left → trash in a red circle. */
export function SwipeDeleteRow({
  children,
  onDelete,
  onPress,
  deleteLabel = 'Delete',
  surfaceColor = colors.bg,
}: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const startX = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        x.stopAnimation((v) => {
          startX.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-ACTION_W, startX.current + g.dx));
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const shouldOpen =
          g.dx < -OPEN_THRESHOLD || startX.current + g.dx < -ACTION_W / 2;
        open.current = shouldOpen;
        Animated.spring(x, {
          toValue: shouldOpen ? -ACTION_W : 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => {
            open.current = false;
            Animated.timing(x, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }).start(() => onDelete());
          }}
          style={styles.deleteHit}
        >
          <View style={styles.deleteCircle}>
            <TrashIcon />
          </View>
        </Pressable>
      </View>
      <Animated.View
        style={[
          styles.front,
          { backgroundColor: surfaceColor, transform: [{ translateX: x }] },
        ]}
        {...pan.panHandlers}
      >
        <Pressable
          onPress={() => {
            if (open.current) {
              open.current = false;
              Animated.spring(x, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
              }).start();
              return;
            }
            onPress?.();
          }}
          // Let nested Switch / controls receive taps without opening edit.
          onStartShouldSetResponderCapture={() => false}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  actions: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 10,
  },
  deleteHit: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  front: {},
});

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { accents } from '../theme';

const COLORS = [
  accents.gold,
  accents.coral,
  accents.sky,
  accents.lime,
  accents.mist,
  '#FF7FB5',
  '#FFFFFF',
];

type Piece = {
  left: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  spin: number;
  duration: number;
};

/**
 * Lightweight confetti — Animated only, no native deps.
 */
export function SoftConfetti({ count = 36 }: { count?: number }) {
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      left: (i / count) * width + ((i * 17) % 40) - 20,
      size: 6 + (i % 5) * 2,
      color: COLORS[i % COLORS.length]!,
      delay: (i % 8) * 40,
      drift: ((i % 7) - 3) * 18,
      spin: (i % 2 === 0 ? 1 : -1) * (120 + (i % 5) * 40),
      duration: 1600 + (i % 6) * 180,
    }));
  }, [count, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} fall={height + 40} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, fall }: { piece: Piece; fall: number }) {
  const y = useRef(new Animated.Value(-20)).current;
  const x = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    y.setValue(-20 - (piece.delay % 60));
    x.setValue(0);
    rot.setValue(0);
    opacity.setValue(0);

    const anim = Animated.sequence([
      Animated.delay(piece.delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: fall,
          duration: piece.duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: piece.drift,
          duration: piece.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 1,
          duration: piece.duration,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fall, opacity, piece, rot, x, y]);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spin}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: piece.left,
        top: 0,
        width: piece.size,
        height: piece.size * 0.55,
        borderRadius: 2,
        backgroundColor: piece.color,
        opacity,
        transform: [{ translateY: y }, { translateX: x }, { rotate }],
      }}
    />
  );
}

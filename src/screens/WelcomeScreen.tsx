import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LogoSpinner } from '../components/LogoSpinner';
import { RootStackParamList } from '../navigation/types';
import { fonts, noFakeBold } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const WELCOME_BLUE = '#BADFFF';
const HOLD_MS = 2200;
const RETRACT_MS = 1000;

/**
 * Splash → blue pill retracts upward (Figma frames 3→15) → hand off to Intro.
 * At start blue is a full rectangle (no cream peeking at rounded corners).
 */
export function WelcomeScreen({ navigation }: Props) {
  const [fullH, setFullH] = useState(0);
  const [fullW, setFullW] = useState(0);
  const blueHeight = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textScale = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    if (height <= 0) return;
    setFullH(height);
    setFullW(width);
    blueHeight.setValue(height);
  };

  useEffect(() => {
    if (!fullH || started.current) return;
    started.current = true;

    const pillRadius = Math.max(fullW * 0.55, 180);

    const anim = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textScale, {
          toValue: 0.92,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(blueHeight, {
          toValue: 0,
          duration: RETRACT_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]);

    anim.start(({ finished }) => {
      if (finished) navigation.replace('Intro');
    });

    return () => anim.stop();
  }, [blueHeight, fullH, fullW, navigation, textOpacity, textScale]);

  const pillRadius = Math.max(fullW * 0.55, 180);
  // Radius only appears as the pill shrinks — full height = square corners, no cream leaks
  const bottomRadius =
    fullH > 0
      ? blueHeight.interpolate({
          inputRange: [0, fullH * 0.4, fullH],
          outputRange: [pillRadius, pillRadius, 0],
          extrapolate: 'clamp',
        })
      : 0;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.cream} pointerEvents="none" />
      <Animated.View
        style={[
          styles.bluePill,
          {
            height: fullH ? blueHeight : '100%',
            borderBottomLeftRadius: bottomRadius,
            borderBottomRightRadius: bottomRadius,
          },
        ]}
        >
          <View style={styles.textWrap}>
            <LogoSpinner />
            <Animated.View
              style={{
                opacity: textOpacity,
                transform: [{ scale: textScale }],
              }}
            >
              <Text style={[styles.title, { opacity: 0.7 }]}>
                Welcome to the{'\n'}future self alarm
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: WELCOME_BLUE,
  },
  cream: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFAEE',
  },
  bluePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: WELCOME_BLUE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 20,
  },
  title: {
    textAlign: 'center',
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    lineHeight: 26,
    color: '#1A1A1A',
    ...noFakeBold,
  },
});

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { SoftConfetti } from '../components/SoftConfetti';
import { RootStackParamList } from '../navigation/types';
import { playCongratsSound } from '../services/uiSounds';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingCongrats'>;

/** Lilac, not gold: the app already leans yellow (buttons, voice sheet). */
const SHEET = accents.lilac;
const FULL_H = Dimensions.get('screen').height;
/** Bottom corner radius the sheet grows into while it retracts (Welcome). */
const SHEET_RADIUS = Math.max(Dimensions.get('window').width * 0.55, 180);

/**
 * Celebration after first alarm — centered copy, arrow to Home, more confetti.
 */
export function OnboardingCongratsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const enterY = useRef(new Animated.Value(16)).current;
  const enterScale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const left = useRef(false);
  const sheetH = useRef(new Animated.Value(FULL_H)).current;
  const radius = sheetH.interpolate({
    inputRange: [0, FULL_H * 0.4, FULL_H],
    outputRange: [SHEET_RADIUS, SHEET_RADIUS, 0],
    extrapolate: 'clamp',
  });

  const goHome = () => {
    if (left.current) return;
    left.current = true;
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    };
    const fallback = setTimeout(go, 1300);
    // Same exit as Welcome: copy fades, the gold sheet retracts upward and
    // its bottom corners round off, then Home.
    Animated.timing(opacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(sheetH, {
      toValue: 0,
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      clearTimeout(fallback);
      go();
    });
  };

  useEffect(() => {
    void playCongratsSound();
    opacity.setValue(0);
    enterY.setValue(16);
    enterScale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(enterY, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(enterScale, {
        toValue: 1,
        friction: 5.2,
        tension: 128,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        enterY.setValue(0);
        enterScale.setValue(1);
        opacity.setValue(1);
      }
    });
    const failsafe = setTimeout(() => {
      enterY.setValue(0);
      enterScale.setValue(1);
      opacity.setValue(1);
    }, 520);
    // Auto-continue — don’t strand on celebration.
    const autoNav = setTimeout(goHome, 4500);
    return () => {
      clearTimeout(failsafe);
      clearTimeout(autoNav);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sheet,
          {
            height: sheetH,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        <SoftConfetti count={72} />
      </Animated.View>
      <Animated.View
        style={[
          styles.inner,
          {
            paddingTop: Math.max(insets.top, 48) + 40,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
            opacity,
            transform: [{ translateY: enterY }, { scale: enterScale }],
          },
        ]}
      >
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>{"You’re in"}</Text>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.sub}>
            Tomorrow starts with your own voice. Nice work.
          </Text>
        </View>
        <View style={styles.footer}>
          <RoundArrowButton onPress={goHome} color={colors.bg} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text,
    textAlign: 'center',
    ...noFakeBold,
  },
  sub: {
    fontFamily: fonts.bodyLight,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    alignItems: 'flex-end',
  },
});

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
import { BUILD_MARK } from '../config/build';
import { useOnboarding } from '../context/OnboardingContext';
import { useSplashChrome } from '../layout/SplashChromeContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold } from '../theme';
import { markIntroSplashFinished, resetIntroSplashGate } from './introSplashGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const WELCOME_BLUE = '#BADFFF';
const HOLD_MS = 2200;
const RETRACT_MS = 1000;

/**
 * Splash on every cold start → Home (done) or Intro (onboarding).
 * At start blue is a full rectangle (no cream peeking at rounded corners).
 */
export function WelcomeScreen({ navigation }: Props) {
  const { setSplashActive } = useSplashChrome();
  const { onboardingComplete } = useOnboarding();
  const onboardingCompleteRef = useRef(onboardingComplete);
  onboardingCompleteRef.current = onboardingComplete;
  const [fullH, setFullH] = useState(0);
  const [fullW, setFullW] = useState(0);
  const blueHeight = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  /** BubbleEnter twin — opacity stays 1; spring from below + scale. */
  const enterY = useRef(new Animated.Value(16)).current;
  const enterScale = useRef(new Animated.Value(0.92)).current;
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
    // Fresh cold start — allow Intro splash gate to be marked after we leave.
    resetIntroSplashGate();
    setSplashActive(true);
    const chromeTimer = setTimeout(() => setSplashActive(false), HOLD_MS);

    enterY.setValue(16);
    enterScale.setValue(0.92);
    const enter = Animated.parallel([
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
    ]);
    enter.start(({ finished }) => {
      if (finished) {
        enterY.setValue(0);
        enterScale.setValue(1);
      }
    });
    const enterFailsafe = setTimeout(() => {
      enterY.setValue(0);
      enterScale.setValue(1);
    }, 520);

    const anim = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(enterScale, {
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
      if (!finished) return;
      // Welcome already played — don't double blue sheet on Intro.
      markIntroSplashFinished();
      navigation.replace(
        onboardingCompleteRef.current ? 'Home' : 'Intro'
      );
    });

    return () => {
      clearTimeout(chromeTimer);
      clearTimeout(enterFailsafe);
      enter.stop();
      anim.stop();
    };
  }, [
    blueHeight,
    enterScale,
    enterY,
    fullH,
    fullW,
    navigation,
    setSplashActive,
    textOpacity,
  ]);

  useEffect(() => {
    return () => setSplashActive(false);
  }, [setSplashActive]);

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
          <Animated.View
            style={[
              styles.textWrap,
              {
                opacity: textOpacity,
                transform: [{ translateY: enterY }, { scale: enterScale }],
              },
            ]}
          >
            <LogoSpinner />
            <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={[styles.title, { opacity: 0.7 }]}>
              Welcome to the{'\n'}future self alarm
            </Text>
            {__DEV__ ? (
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.buildMark}>{BUILD_MARK}</Text>
            ) : null}
          </Animated.View>
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
    backgroundColor: colors.bg,
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
  buildMark: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#1A1A1A66',
    textAlign: 'center',
  },
});

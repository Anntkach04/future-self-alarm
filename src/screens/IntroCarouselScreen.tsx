import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Pressable,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoSpinner } from '../components/LogoSpinner';
import { OnboardingProgress } from '../components/OnboardingProgress';
import { RoundArrowButton } from '../components/RoundArrowButton';
import {
  CARD_COLORS,
  StackedIntroCards,
} from '../components/StackedIntroCards';
import { BUILD_MARK } from '../config/build';
import { INTRO_SLIDES } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';
import { useSplashChrome } from '../layout/SplashChromeContext';
import { colors, fonts, headingClipFix, noFakeBold, spacing } from '../theme';
import {
  armIntroSplash,
  isIntroSplashFinished,
  subscribeIntroSplash,
} from './introSplashGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Intro'>;

const WELCOME_BLUE = '#BADFFF';
const LAST = INTRO_SLIDES.length - 1;
const RETRACT_MS = 850;

/**
 * Cream intro underneath → full-screen blue sheet slides up (translateY, native).
 * Explicit width/height — never rely on absoluteFill alone (it collapsed to a
 * content-sized “cap” at the top on device).
 */
export function IntroCarouselScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { setSplashActive } = useSplashChrome();
  const win = Dimensions.get('window');

  const [index, setIndex] = useState(0);
  const alreadyDone = isIntroSplashFinished();
  const [splashDone, setSplashDone] = useState(alreadyDone);
  const [overlayOn, setOverlayOn] = useState(!alreadyDone);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ w: win.width, h: win.height });

  const indexRef = useRef(0);
  const splashDoneRef = useRef(alreadyDone);
  const retractingRef = useRef(false);
  const frameRef = useRef(frame);
  const slideY = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const enterY = useRef(new Animated.Value(16)).current;
  const enterScale = useRef(new Animated.Value(0.92)).current;

  indexRef.current = index;
  splashDoneRef.current = splashDone;
  frameRef.current = frame;

  const finishOverlay = () => {
    splashDoneRef.current = true;
    setSplashDone(true);
    setOverlayOn(false);
    setSplashActive(false);
  };

  const startRetract = () => {
    if (retractingRef.current || splashDoneRef.current) return;
    retractingRef.current = true;
    setSplashActive(false);

    const h = Math.max(frameRef.current.h, Dimensions.get('window').height, 1);

    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: -h,
        duration: RETRACT_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => finishOverlay());

    // Hard failsafe — never leave a stuck blue cap on screen.
    setTimeout(finishOverlay, RETRACT_MS + 200);
  };

  useEffect(() => {
    if (isIntroSplashFinished()) {
      finishOverlay();
      return;
    }

    setSplashActive(true);
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

    armIntroSplash();
    const unsub = subscribeIntroSplash(startRetract);
    const poll = setInterval(() => {
      if (isIntroSplashFinished()) startRetract();
    }, 200);
    const hard = setTimeout(startRetract, 1500);

    return () => {
      unsub();
      clearInterval(poll);
      clearTimeout(hard);
      clearTimeout(enterFailsafe);
      enter.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSplashActive]);

  const goNextCard = () => {
    if (!splashDoneRef.current) return;
    const i = indexRef.current;
    if (i >= LAST) {
      // Value first: questions + voice before any account (guest session).
      navigation.navigate('Name');
      return;
    }
    setIndex(i + 1);
  };

  const goPrevCard = () => {
    if (!splashDoneRef.current) return;
    setIndex((prev) => Math.max(prev - 1, 0));
  };

  const onBarPress = (i: number) => {
    if (!splashDoneRef.current) return;
    setIndex(i);
  };

  const heading = INTRO_SLIDES[index]?.title ?? '';
  // Soft pill edge while sliding — small enough not to collapse the sheet.
  const edgeRadius = Math.min(48, frame.w * 0.12);

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width < 2 || height < 2) return;
        frameRef.current = { w: width, h: height };
        if (width !== frame.w || height !== frame.h) {
          setFrame({ w: width, h: height });
        }
      }}
    >
      {/* Intro always mounted under the blue sheet */}
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, spacing.inset),
          },
        ]}
        pointerEvents={splashDone ? 'auto' : 'none'}
      >
        <OnboardingProgress
          index={index}
          colors={INTRO_SLIDES.map((slide) => CARD_COLORS[slide.card])}
          onPress={onBarPress}
        />
        {/* Fixed-height heading band — 2- vs 3-line titles must not move cards. */}
        <View style={styles.headingBand}>
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.heading} numberOfLines={3}>
            {heading}
          </Text>
        </View>

        <View
          style={styles.stageWrap}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== stageBox.w || height !== stageBox.h) {
              setStageBox({ w: width, h: height });
            }
          }}
        >
          <StackedIntroCards
            slides={INTRO_SLIDES}
            index={index}
            onNext={goNextCard}
            onPrev={goPrevCard}
            interactive={splashDone}
            maxWidth={stageBox.w}
            maxHeight={stageBox.h}
          />
        </View>

        <View style={styles.nextWrap}>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => navigation.navigate('SignIn', { mode: 'restore' })}
            style={({ pressed }) => [styles.haveAccount, pressed && { opacity: 0.5 }]}
          >
            <Text maxFontSizeMultiplier={1.3} lineBreakStrategyIOS="push-out" style={styles.haveAccountText}>I already have an account</Text>
          </Pressable>
          <RoundArrowButton onPress={goNextCard} color={colors.fab} />
        </View>
      </View>

      {overlayOn ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: frame.w,
            height: frame.h,
            backgroundColor: WELCOME_BLUE,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomLeftRadius: edgeRadius,
            borderBottomRightRadius: edgeRadius,
            zIndex: 50,
            elevation: 50,
            transform: [{ translateY: slideY }],
          }}
        >
          <Animated.View
            style={{
              alignItems: 'center',
              gap: 20,
              opacity: textOpacity,
              transform: [{ translateY: enterY }, { scale: enterScale }],
            }}
          >
            <LogoSpinner />
            <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.welcomeTitle}>
              Welcome to the{'\n'}future self alarm
            </Text>
            {__DEV__ ? (
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.buildMark}>{BUILD_MARK}</Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFAEE',
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    overflow: 'visible',
  },
  /** Reserves 2 lines (all intro titles are 2 lines) so cards stay put. */
  headingBand: {
    marginTop: 28,
    marginBottom: 8,
    minHeight: 44 * 2,
    justifyContent: 'flex-start',
    width: '100%',
  },
  heading: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 44,
    color: '#1A1A1A',
    textAlign: 'left',
    ...noFakeBold,
    ...headingClipFix,
  },
  stageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Bleed past text inset so cards can sit closer to the screen edge.
    marginHorizontal: -spacing.inset,
    width: undefined,
    alignSelf: 'stretch',
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
    minHeight: 180,
    paddingHorizontal: 8,
  },
  nextWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  haveAccount: {
    paddingVertical: 8,
    flexShrink: 1,
    marginRight: 16,
  },
  haveAccountText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#1A1A1A',
    opacity: 0.6,
    textDecorationLine: 'underline',
  },
  welcomeTitle: {
    textAlign: 'center',
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    lineHeight: 26,
    color: '#1A1A1A',
    opacity: 0.7,
    paddingHorizontal: 40,
    ...noFakeBold,
  },
  buildMark: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#1A1A1A66',
    textAlign: 'center',
  },
});

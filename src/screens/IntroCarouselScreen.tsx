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
import { OnboardingProgress } from '../components/OnboardingProgress';
import { RoundArrowButton } from '../components/RoundArrowButton';
import {
  CARD_COLORS,
  INTRO_CARD_TOP_INSET,
  INTRO_STAGE_H,
  StackedIntroCards,
} from '../components/StackedIntroCards';
import { INTRO_SLIDES } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Intro'>;

const WELCOME_BLUE = '#BADFFF';
const HOLD_MS = 2200;
const RETRACT_MS = 1000;
const LAST = INTRO_SLIDES.length - 1;
const HEADING_SIZE = 55;
const HEADING_LINE = 53;
const HEADING_GAP = 40;

/**
 * Splash overlay retracts over a layout that is already final —
 * progress top, cards centered, CTA bottom. Nothing remounts when it lifts.
 */
export function IntroCarouselScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const lock = useRef(false);
  const splashStarted = useRef(false);

  const blueHeight = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (height <= 0) return;
    setFrame({ w: width, h: height });
    if (!splashStarted.current) {
      blueHeight.setValue(height);
    }
  };

  useEffect(() => {
    if (!frame.h || splashStarted.current || splashDone) return;
    splashStarted.current = true;

    const anim = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.quad),
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
      if (finished) setSplashDone(true);
    });

    return () => anim.stop();
  }, [blueHeight, frame.h, splashDone, textOpacity]);

  const pillRadius = Math.max(frame.w * 0.55, 180);
  const bottomRadius =
    frame.h > 0
      ? blueHeight.interpolate({
          inputRange: [0, frame.h * 0.4, frame.h],
          outputRange: [pillRadius, pillRadius, 0],
          extrapolate: 'clamp',
        })
      : 0;

  const withLock = (fn: () => void) => {
    if (lock.current || !splashDone) return;
    lock.current = true;
    fn();
    setTimeout(() => {
      lock.current = false;
    }, 280);
  };

  const goNextCard = () => {
    withLock(() => {
      if (index >= LAST) {
        navigation.navigate('Name');
        return;
      }
      setIndex((prev) => prev + 1);
    });
  };

  const goPrevCard = () => {
    withLock(() => setIndex((prev) => Math.max(prev - 1, 0)));
  };

  const onBarPress = (i: number) => {
    withLock(() => setIndex(i));
  };

  const heading = INTRO_SLIDES[index]?.title ?? '';
  const [stageH, setStageH] = useState(0);
  const headingBottom =
    stageH > 0
      ? stageH / 2 + INTRO_STAGE_H / 2 + HEADING_GAP - INTRO_CARD_TOP_INSET
      : 0;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <View
        style={styles.safe}
        pointerEvents={splashDone ? 'auto' : 'none'}
      >
        <OnboardingProgress
          index={index}
          colors={INTRO_SLIDES.map((slide) => CARD_COLORS[slide.card])}
          onPress={onBarPress}
        />

        <View
          style={styles.stageWrap}
          pointerEvents={splashDone ? 'auto' : 'none'}
          onLayout={(e) => setStageH(e.nativeEvent.layout.height)}
        >
          <Text
            pointerEvents="none"
            style={[
              styles.heading,
              headingBottom > 0 ? { bottom: headingBottom } : null,
            ]}
          >
            {heading}
          </Text>
          <StackedIntroCards
            slides={INTRO_SLIDES}
            index={index}
            onNext={goNextCard}
            onPrev={goPrevCard}
            interactive={splashDone}
          />
        </View>

        <View style={styles.nextWrap} pointerEvents={splashDone ? 'auto' : 'none'}>
          <RoundArrowButton onPress={goNextCard} color={colors.fab} />
        </View>
      </View>

      {!splashDone ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bluePill,
            {
              height: frame.h ? blueHeight : '100%',
              borderBottomLeftRadius: bottomRadius,
              borderBottomRightRadius: bottomRadius,
            },
          ]}
        >
          <View style={styles.welcomeBlock}>
            <LogoSpinner />
            <Animated.View style={{ opacity: textOpacity }}>
              <Text style={[styles.welcomeTitle, { opacity: 0.7 }]}>
                Welcome to the{'\n'}future self alarm
              </Text>
            </Animated.View>
          </View>
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
    paddingTop: 16,
    paddingBottom: spacing.inset,
  },
  stageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  heading: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: fonts.headingRegular,
    fontSize: HEADING_SIZE,
    lineHeight: HEADING_LINE,
    letterSpacing: 0.374,
    color: '#1A1A1A',
    textAlign: 'left',
    zIndex: 2,
    ...noFakeBold,
  },
  nextWrap: {
    width: '100%',
    alignItems: 'flex-end',
    zIndex: 3,
  },
  bluePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: WELCOME_BLUE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBlock: {
    alignItems: 'center',
    gap: 20,
  },
  welcomeTitle: {
    textAlign: 'center',
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    lineHeight: 26,
    color: '#1A1A1A',
    paddingHorizontal: 40,
    ...noFakeBold,
  },
});

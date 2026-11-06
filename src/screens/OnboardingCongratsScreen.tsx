import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { SoftConfetti } from '../components/SoftConfetti';
import { RootStackParamList } from '../navigation/types';
import { playCongratsSound } from '../services/uiSounds';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingCongrats'>;

const GOLD = accents.gold;

/**
 * Celebration after first alarm — centered copy, arrow to Home, more confetti.
 */
export function OnboardingCongratsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const enterY = useRef(new Animated.Value(16)).current;
  const enterScale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const left = useRef(false);

  const goHome = () => {
    if (left.current) return;
    left.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
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
      <SoftConfetti count={72} />
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
          <Text maxFontSizeMultiplier={1.2} style={styles.title}>{"you’re in"}</Text>
          <Text maxFontSizeMultiplier={1.5} style={styles.sub}>
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
    backgroundColor: GOLD,
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
    gap: 14,
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 52,
    color: colors.text,
    textAlign: 'center',
    ...noFakeBold,
  },
  sub: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    alignItems: 'flex-end',
  },
});

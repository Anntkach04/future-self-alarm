import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { KaraokeLine } from '../components/KaraokeLine';
import { LiveWaveform } from '../components/LiveWaveform';
import { LogoSpinner } from '../components/LogoSpinner';
import { MicRecordButton } from '../components/MicRecordButton';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { VOICE_ONBOARDING_SKIP_ENABLED } from '../config/devBypass';
import { buildVoiceScriptLines, VOICE_TIPS } from '../data/voiceScript';
import { useSmartDictaphone } from '../hooks/useSmartDictaphone';
import { RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, noFakeBold, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceRecord'>;

const COMPLETE_COLOR = accents.gold;

export function VoiceRecordScreen({ navigation }: Props) {
  const { answers, setVoiceSample, markOnboardingComplete } = useOnboarding();
  const lines = buildVoiceScriptLines(answers.name);
  const [lineIndex, setLineIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [frameH, setFrameH] = useState(0);
  const finishingRef = useRef(false);
  const advancingRef = useRef(false);
  const doneLineRef = useRef(-1);
  const insets = useSafeAreaInsets();

  const currentLine = lines[lineIndex] ?? '';
  const dictaphone = useSmartDictaphone(currentLine);

  const recording = dictaphone.status === 'recording' && !complete;

  const lineOpacity = useRef(new Animated.Value(1)).current;
  const lineY = useRef(new Animated.Value(0)).current;
  const goldHeight = useRef(new Animated.Value(0)).current;
  const completeOpacity = useRef(new Animated.Value(0)).current;
  const readOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    dictaphone.requestPermission();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setFrameH(next);
  };

  const finishReading = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const uri = await dictaphone.stop();
    if (uri) {
      setVoiceSample(uri, dictaphone.durationSec);
    }
    setComplete(true);

    Animated.parallel([
      Animated.timing(readOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(goldHeight, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(420),
        Animated.timing(completeOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [completeOpacity, dictaphone, goldHeight, readOpacity, setVoiceSample]);

  const advanceLine = useCallback(() => {
    if (advancingRef.current || finishingRef.current) return;
    advancingRef.current = true;

    Animated.parallel([
      Animated.timing(lineOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lineY, {
        toValue: -16,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        advancingRef.current = false;
        return;
      }

      if (lineIndex >= lines.length - 1) {
        finishReading();
        return;
      }

      setLineIndex((prev) => prev + 1);
      lineY.setValue(16);
      Animated.parallel([
        Animated.timing(lineOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(lineY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        advancingRef.current = false;
      });
    });
  }, [finishReading, lineIndex, lineOpacity, lineY, lines.length]);

  useEffect(() => {
    if (!recording || complete || advancingRef.current) return;
    if (dictaphone.spokenCount < dictaphone.wordCount || dictaphone.wordCount === 0) {
      return;
    }
    if (doneLineRef.current === lineIndex) return;
    doneLineRef.current = lineIndex;
    const t = setTimeout(() => advanceLine(), 220);
    return () => clearTimeout(t);
  }, [
    advanceLine,
    complete,
    dictaphone.spokenCount,
    dictaphone.wordCount,
    lineIndex,
    recording,
  ]);

  const onMicPress = async () => {
    if (complete) return;
    if (dictaphone.status === 'recording') {
      finishingRef.current = false;
      await dictaphone.stop();
      setLineIndex(0);
      doneLineRef.current = -1;
      lineOpacity.setValue(1);
      lineY.setValue(0);
      advancingRef.current = false;
      return;
    }
    finishingRef.current = false;
    setLineIndex(0);
    doneLineRef.current = -1;
    lineOpacity.setValue(1);
    lineY.setValue(0);
    await dictaphone.start();
  };

  const goReview = () => {
    navigation.replace('VoiceReview');
  };

  const skipForDev = () => {
    markOnboardingComplete();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const pillRadius = 220;
  const goldH = goldHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(frameH, 1)],
  });
  const bottomRadius = goldHeight.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [pillRadius, pillRadius, 0],
    extrapolate: 'clamp',
  });

  const hint =
    dictaphone.status === 'recording'
      ? dictaphone.hearing
        ? 'Keep reading the highlighted words'
        : 'I’m listening — read the line aloud'
      : dictaphone.status === 'stopped'
        ? 'Tap to try again'
        : 'Tap the mic and read';

  const coach =
    recording && dictaphone.hearing && dictaphone.spokenCount === 0
      ? 'Only the script counts — random words won’t move forward.'
      : !dictaphone.recognitionReady && dictaphone.status !== 'recording'
        ? 'On iPhone, install a dev build once: npx expo run:ios'
        : null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {VOICE_ONBOARDING_SKIP_ENABLED && !complete ? (
        <Pressable
          accessibilityRole="button"
          onPress={skipForDev}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>skip (dev)</Text>
        </Pressable>
      ) : null}
      <SafeAreaView style={styles.safe}>
        <Animated.View
          pointerEvents={complete ? 'none' : 'auto'}
          style={[styles.readLayer, { opacity: readOpacity }]}
        >
          <BackButton />
          <BubbleEnter delay={0} fromY={16}>
            <Text style={styles.title}>{`Read this\nout loud`}</Text>
          </BubbleEnter>
          <BubbleEnter delay={50} fromY={12}>
            <Text style={styles.subtitle}>
              In a calm, unhurried voice. {VOICE_TIPS[0].toLowerCase()}.
            </Text>
          </BubbleEnter>

          <View style={styles.stage}>
            <BubbleEnter delay={80} fromY={18} style={{ width: '100%' }}>
              <Animated.View
                style={{
                  opacity: lineOpacity,
                  transform: [{ translateY: lineY }],
                  width: '100%',
                }}
              >
                <KaraokeLine
                  text={currentLine}
                  spokenCount={dictaphone.spokenCount}
                />
              </Animated.View>
            </BubbleEnter>
          </View>

          {dictaphone.error ? (
            <Text style={styles.error}>{dictaphone.error}</Text>
          ) : null}

          {coach ? <Text style={styles.coach}>{coach}</Text> : null}

          <BubbleEnter delay={100} fromY={16}>
            <View style={styles.controls}>
              <LiveWaveform
                active={recording}
                metering={dictaphone.metering}
                hearing={dictaphone.hearing}
              />
              <MicRecordButton
                recording={recording}
                onPress={onMicPress}
              />
              <Text style={styles.hint}>{hint}</Text>
            </View>
          </BubbleEnter>
        </Animated.View>
      </SafeAreaView>

      <Animated.View
        pointerEvents={complete ? 'auto' : 'none'}
        style={[
          styles.goldPill,
          {
            height: frameH ? goldH : 0,
            borderBottomLeftRadius: bottomRadius,
            borderBottomRightRadius: bottomRadius,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.completeInner,
            {
              opacity: completeOpacity,
              paddingTop: Math.max(insets.top, 48) + 32,
              paddingBottom: Math.max(insets.bottom, 16) + 20,
            },
          ]}
        >
          <View style={styles.completeCopy}>
            <LogoSpinner />
            <Text style={styles.completeTitle}>You’re all set!</Text>
            <Text style={styles.completeSub}>
              Your future self has your voice now.
            </Text>
          </View>
          <View style={styles.completeFooter}>
            <RoundArrowButton onPress={goReview} color={colors.bg} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  readLayer: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    paddingBottom: spacing.inset,
  },
  skipBtn: {
    position: 'absolute',
    top: 48,
    right: spacing.inset,
    zIndex: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 64,
    lineHeight: 58,
    letterSpacing: 0.37,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  subtitle: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: colors.textMuted,
    marginBottom: 32,
    maxWidth: 320,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  error: {
    fontFamily: fonts.body,
    textAlign: 'center',
    color: accents.coral,
    marginBottom: spacing.sm,
  },
  coach: {
    fontFamily: fonts.bodyLight,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
  },
  goldPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COMPLETE_COLOR,
    overflow: 'hidden',
  },
  completeInner: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    paddingTop: 80,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  completeCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  completeTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 52,
    textAlign: 'center',
    color: colors.text,
    ...noFakeBold,
  },
  completeSub: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.7,
  },
  completeFooter: {
    alignItems: 'flex-end',
    width: '100%',
  },
});

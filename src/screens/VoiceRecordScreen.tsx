import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { LoadingLabel } from '../components/LoadingLabel';
import { LogoSpinner } from '../components/LogoSpinner';
import { MicRecordButton } from '../components/MicRecordButton';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import {
  FOUNDER_AUTH_SKIP_ENABLED,
  VOICE_ONBOARDING_SKIP_ENABLED,
} from '../config/devBypass';
import { getDefaultPremadeVoiceId } from '../services/defaultVoice';
import { buildVoiceScriptLines } from '../data/voiceScript';
import { useSmartDictaphone } from '../hooks/useSmartDictaphone';
import { RootStackParamList } from '../navigation/types';
import { cloneOnboardingVoice } from '../services/cloneOnboardingVoice';
import { isLineFullyLit } from '../services/speechMatch';
import { playAllSetSound, playLineSuccessSound } from '../services/uiSounds';
import { accents, colors, fonts, noFakeBold, noFakeLight, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceRecord'>;

const COMPLETE_COLOR = accents.gold;

export function VoiceRecordScreen({ navigation }: Props) {
  const {
    answers,
    setVoiceSample,
    setVoiceId,
    setPreview,
    markOnboardingComplete,
  } = useOnboarding();
  const lines = buildVoiceScriptLines(answers.name);
  const [lineIndex, setLineIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [frameH, setFrameH] = useState(0);
  const [cloneReady, setCloneReady] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const finishingRef = useRef(false);
  const advancingRef = useRef(false);
  const doneLineRef = useRef(-1);
  const cloneStartedRef = useRef(false);
  const sampleUriRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

  const currentLine = lines[lineIndex] ?? '';
  const dictaphone = useSmartDictaphone(currentLine);

  const recording = dictaphone.status === 'recording' && !complete;

  const lineOpacity = useRef(new Animated.Value(1)).current;
  const lineY = useRef(new Animated.Value(0)).current;
  const goldHeight = useRef(new Animated.Value(0)).current;
  const completeOpacity = useRef(new Animated.Value(0)).current;
  const readOpacity = useRef(new Animated.Value(1)).current;
  /** State (not ref) so advance effect re-runs when the gate opens. */
  const [lineReady, setLineReady] = useState(false);

  useEffect(() => {
    dictaphone.requestPermission();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setFrameH(next);
  };

  const startClone = useCallback(
    async (sampleUri: string) => {
      if (cloneStartedRef.current) return;
      cloneStartedRef.current = true;
      setCloning(true);
      setCloneError(null);
      try {
        const result = await cloneOnboardingVoice({ sampleUri, answers });
        setVoiceId(result.voiceId, result.isDemo);
        setPreview(result.previewPath, result.previewText);
        setCloneReady(true);
      } catch (e) {
        cloneStartedRef.current = false;
        setCloneError(e instanceof Error ? e.message : 'Voice cloning failed');
      } finally {
        setCloning(false);
      }
    },
    [answers, setPreview, setVoiceId]
  );

  const stopRecording = dictaphone.stop;
  const finishReading = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const result = await stopRecording();
    if (!result.uri) {
      finishingRef.current = false;
      return;
    }
    sampleUriRef.current = result.uri;
    setVoiceSample(result.uri, result.durationSec);
    setComplete(true);
    void playAllSetSound();
    void startClone(result.uri);

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
  }, [
    completeOpacity,
    goldHeight,
    readOpacity,
    setVoiceSample,
    startClone,
    stopRecording,
  ]);

  const finishReadingRef = useRef(finishReading);
  finishReadingRef.current = finishReading;
  const linesLenRef = useRef(lines.length);
  linesLenRef.current = lines.length;
  const lineIndexRef = useRef(lineIndex);
  lineIndexRef.current = lineIndex;

  const advanceLine = useCallback(() => {
    if (advancingRef.current || finishingRef.current) return;
    advancingRef.current = true;
    void playLineSuccessSound();

    const fromIndex = lineIndexRef.current;
    let moved = false;
    const moveOn = () => {
      if (moved) return;
      moved = true;
      if (fromIndex >= linesLenRef.current - 1) {
        void finishReadingRef.current();
        return;
      }
      setLineIndex(fromIndex + 1);
      lineY.setValue(16);
      lineOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(lineOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(lineY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        advancingRef.current = false;
      });
    };

    Animated.parallel([
      Animated.timing(lineOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lineY, {
        toValue: -12,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => moveOn());
    setTimeout(moveOn, 280);
  }, [lineOpacity, lineY]);

  const advanceLineRef = useRef(advanceLine);
  advanceLineRef.current = advanceLine;

  // Tiny gate so leftover STT from the *previous* line can't auto-skip.
  useEffect(() => {
    setLineReady(false);
    const wait = lineIndex === 0 ? 80 : 220;
    const t = setTimeout(() => setLineReady(true), wait);
    return () => clearTimeout(t);
  }, [lineIndex]);

  /**
   * Metering re-renders constantly. A setTimeout in an effect that deps on
   * advanceLine was cleared every ~120ms and never fired. Poll with refs instead.
   */
  useEffect(() => {
    if (!recording || complete) return;
    const id = setInterval(() => {
      if (!lineReady) return;
      if (advancingRef.current || finishingRef.current) return;
      const idx = lineIndexRef.current;
      if (doneLineRef.current === idx) return;
      const spoken = dictaphone.spokenCount;
      const enough =
        dictaphone.lineHeardEnough || isLineFullyLit(currentLine, spoken);
      if (!enough) return;
      doneLineRef.current = idx;
      advanceLineRef.current();
    }, 200);
    return () => clearInterval(id);
  }, [
    complete,
    currentLine,
    dictaphone.lineHeardEnough,
    dictaphone.spokenCount,
    lineReady,
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

  const goPreview = () => {
    if (!cloneReady) return;
    navigation.replace('VoicePreview');
  };

  const retryClone = () => {
    const uri = sampleUriRef.current;
    if (!uri) return;
    cloneStartedRef.current = false;
    setCloneReady(false);
    void startClone(uri);
  };

  const skipForDev = () => {
    // Always give a working voice so alarm testing isn't blocked by cloning.
    setVoiceId(getDefaultPremadeVoiceId(), true);
    markOnboardingComplete();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  /** Continue past clone failure (auth / server) with a premade voice. */
  const skipCloneAndContinue = () => {
    setVoiceId(getDefaultPremadeVoiceId(), true);
    setPreview(null, null);
    setCloneError(null);
    setCloneReady(true);
    navigation.replace('VoicePreview');
  };

  const forceContinue = () => {
    if (!recording || complete) return;
    if (lineIndex >= lines.length - 1) {
      void finishReading();
      return;
    }
    doneLineRef.current = lineIndex;
    advanceLine();
  };

  const pillRadius = 220;
  const screenH = Math.max(frameH, Dimensions.get('window').height);
  const goldH = goldHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenH],
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
        : 'I’m listening. Read the line aloud'
      : dictaphone.status === 'stopped'
        ? 'Tap to try again'
        : 'Tap the mic and read';

  const coach =
    !dictaphone.recognitionReady && dictaphone.status !== 'recording'
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
          <Text style={styles.skipText}>skip → test alarm</Text>
        </Pressable>
      ) : null}
      <SafeAreaView style={styles.safe}>
        <Animated.View
          pointerEvents={complete ? 'none' : 'auto'}
          style={[styles.readLayer, { opacity: readOpacity }]}
        >
          <BubbleEnter delay={0} fromY={10}>
            <BackButton />
          </BubbleEnter>
          <BubbleEnter delay={0} fromY={16}>
            <Text style={styles.title}>{`Read this\nout loud`}</Text>
          </BubbleEnter>
          <BubbleEnter delay={50} fromY={12}>
            <Text style={styles.subtitle}>Find a quiet room.</Text>
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
              {recording ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={forceContinue}
                  style={styles.nextLineBtn}
                >
                  <Text style={styles.nextLineText}>
                    {lineIndex >= lines.length - 1
                      ? 'Finish recording →'
                      : 'Continue →'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </BubbleEnter>
        </Animated.View>
      </SafeAreaView>

      <Animated.View
        pointerEvents={complete ? 'auto' : 'none'}
        style={[
          styles.goldPill,
          complete
            ? StyleSheet.absoluteFillObject
            : {
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
            {cloning ? <LogoSpinner /> : null}
            <Text style={styles.completeTitle}>You’re all set!</Text>
            {cloneError ? (
              <Text style={styles.completeError}>{cloneError}</Text>
            ) : cloneReady ? (
              <Text style={styles.completeSub}>
                Your future self has your voice now.
              </Text>
            ) : (
              <>
                <LoadingLabel
                  text="Cloning your voice"
                  style={styles.completeSub}
                />
                <Text style={styles.cloneEta}>
                  This usually takes about 1-2 minutes
                </Text>
              </>
            )}
          </View>
          <View style={styles.completeFooter}>
            {cloneError ? (
              <>
                <Pressable
                  onPress={() => navigation.replace('VoiceRecord')}
                  style={styles.goldLinkBtn}
                >
                  <Text style={styles.goldLinkText}>re-record</Text>
                </Pressable>
                {FOUNDER_AUTH_SKIP_ENABLED ? (
                  <Pressable
                    onPress={skipCloneAndContinue}
                    style={styles.goldLinkBtn}
                  >
                    <Text style={styles.goldLinkText}>skip → continue</Text>
                  </Pressable>
                ) : null}
                <RoundArrowButton
                  onPress={() => {
                    if (/sign in/i.test(cloneError)) {
                      navigation.replace('SignIn');
                      return;
                    }
                    retryClone();
                  }}
                  color={colors.bg}
                />
              </>
            ) : cloneReady ? (
              <RoundArrowButton onPress={goPreview} color={colors.bg} />
            ) : (
              <View style={styles.footerPlaceholder} />
            )}
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
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: 0.37,
    color: colors.text,
    marginBottom: 12,
    ...noFakeBold,
  },
  subtitle: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: colors.textMuted,
    marginBottom: 16,
    maxWidth: 320,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    overflow: 'visible',
    minHeight: 72,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 12,
    paddingBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  nextLineBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  nextLineText: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
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
  cloneEta: {
    marginTop: 8,
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.55,
  },
  completeFooter: {
    alignItems: 'flex-end',
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  goldLinkBtn: {
    marginRight: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  goldLinkText: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.text,
    textDecorationLine: 'underline',
    ...noFakeLight,
  },
  completeError: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.8,
    paddingHorizontal: 8,
  },
  footerPlaceholder: {
    height: 56,
    width: 56,
  },
});

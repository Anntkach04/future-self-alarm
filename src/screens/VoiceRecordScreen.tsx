import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
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
import { TextArrowButton } from '../components/TextArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { VOICE_ONBOARDING_SKIP_ENABLED } from '../config/devBypass';
import { getDefaultPremadeVoiceId } from '../services/defaultVoice';
import { buildVoiceScriptLines } from '../data/voiceScript';
import { useSmartDictaphone } from '../hooks/useSmartDictaphone';
import { RootStackParamList } from '../navigation/types';
import { cloneOnboardingVoice } from '../services/cloneOnboardingVoice';
import {
  displayWords,
  isLineFullyLit,
  spokenDisplayCount,
} from '../services/speechMatch';
import { playAllSetSound } from '../services/uiSounds';
import { ensureAiConsent } from '../services/aiConsent';
import * as Haptics from 'expo-haptics';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing, opticalLeft } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceRecord'>;

const COMPLETE_COLOR = accents.gold;
/** Brief hold on "You’re all set", then leave. Animation is cosmetic only. */
const SUCCESS_HOLD_MS = 2800;
/** Pause on a finished line before the next one appears. */
const LINE_HOLD_MS = 1000;
/** Bottom corner radius the gold sheet grows into while it retracts (Welcome). */
const SHEET_RADIUS = Math.max(Dimensions.get('window').width * 0.55, 180);

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
  const advanceLineRef = useRef<() => boolean>(() => false);
  /** Line index whose auto-advance is already scheduled. */
  const lineHoldRef = useRef(-1);
  // Do NOT advance from the STT callback — it fired on the first matches.
  // Interval below waits until the line is nearly red + a short quiet settle.
  const dictaphone = useSmartDictaphone(currentLine);

  const recording = dictaphone.status === 'recording' && !complete;

  const lineOpacity = useRef(new Animated.Value(1)).current;
  const lineY = useRef(new Animated.Value(0)).current;
  /** Full-screen gold fade (native) — avoids empty yellow wait before copy. */
  const goldPillOpacity = useRef(new Animated.Value(0)).current;
  const goldPillY = useRef(new Animated.Value(0)).current;
  const completeOpacity = useRef(new Animated.Value(0)).current;
  /** Gold sheet height: full screen, then retracts upward like Welcome. */
  const sheetFullH = Dimensions.get('screen').height;
  const goldSheetH = useRef(new Animated.Value(sheetFullH)).current;
  const sheetRadius = goldSheetH.interpolate({
    inputRange: [0, sheetFullH * 0.4, sheetFullH],
    outputRange: [SHEET_RADIUS, SHEET_RADIUS, 0],
    extrapolate: 'clamp',
  });
  /** Same enter motion as BubbleEnter (spring from below + scale). */
  const completeEnterY = useRef(new Animated.Value(16)).current;
  const completeEnterScale = useRef(new Animated.Value(0.92)).current;
  const readOpacity = useRef(new Animated.Value(1)).current;
  /** State (not ref) so advance gate opens after line change. */
  const [lineReady, setLineReady] = useState(false);
  const quietSinceRef = useRef(0);
  const lastSpokenCountRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  /** One-shot: success leave armed — never re-arm until re-record. */
  const successLeaveArmedRef = useRef(false);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const [consentDeclined, setConsentDeclined] = useState(false);

  /** Voice leaves the phone only after explicit consent (App Review 5.1.2). */
  const consentToRecord = useCallback(async (fromTap = false) => {
    const ok = await ensureAiConsent({ fromTap });
    setConsentDeclined(!ok);
    return ok;
  }, []);

  useEffect(() => {
    // Wait for the push animation: an alert raised mid-transition can be
    // dropped by iOS. The mic tap asks again anyway.
    const t = setTimeout(() => {
      void (async () => {
        if (await consentToRecord()) dictaphone.requestPermission();
      })();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const raw = e instanceof Error ? e.message : '';
        // "sign in" errors keep their text: the arrow sends people to Sign in.
        setCloneError(
          /sign in/i.test(raw)
            ? raw
            : userFacingError(e, 'Voice cloning failed. Tap the arrow to try again.')
        );
      } finally {
        setCloning(false);
      }
    },
    [answers, setPreview, setVoiceId]
  );

  const stopRecording = dictaphone.stop;

  /** Reset complete-transition values so a retry never inherits a stuck gold sheet. */
  const resetCompleteVisuals = useCallback(() => {
    goldPillOpacity.stopAnimation();
    goldPillY.stopAnimation();
    readOpacity.stopAnimation();
    completeOpacity.stopAnimation();
    completeEnterY.stopAnimation();
    completeEnterScale.stopAnimation();
    goldPillOpacity.setValue(0);
    goldPillY.setValue(0);
    goldSheetH.stopAnimation();
    goldSheetH.setValue(sheetFullH);
    readOpacity.setValue(1);
    completeOpacity.setValue(0);
    completeEnterY.setValue(16);
    completeEnterScale.setValue(0.92);
  }, [
    completeEnterScale,
    completeEnterY,
    completeOpacity,
    goldPillOpacity,
    goldPillY,
    goldSheetH,
    readOpacity,
    sheetFullH,
  ]);

  /** BubbleEnter twin: spring from below + scale (opacity stays visible). */
  const playBubbleSpring = useCallback(() => {
    completeEnterY.stopAnimation();
    completeEnterScale.stopAnimation();
    completeEnterY.setValue(16);
    completeEnterScale.setValue(0.92);
    Animated.parallel([
      Animated.spring(completeEnterY, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(completeEnterScale, {
        toValue: 1,
        friction: 5.2,
        tension: 128,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        completeEnterY.setValue(0);
        completeEnterScale.setValue(1);
      }
    });
  }, [completeEnterScale, completeEnterY]);

  const playCompleteEnter = useCallback(() => {
    goldPillOpacity.stopAnimation();
    readOpacity.stopAnimation();
    completeOpacity.stopAnimation();
    goldPillOpacity.setValue(0);
    completeOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(readOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(goldPillOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    playBubbleSpring();
    // Failsafe — never leave a blank gold sheet if a spring glitches.
    setTimeout(() => {
      goldPillOpacity.setValue(1);
      completeOpacity.setValue(1);
      completeEnterY.setValue(0);
      completeEnterScale.setValue(1);
    }, 520);
  }, [
    completeEnterScale,
    completeEnterY,
    completeOpacity,
    goldPillOpacity,
    playBubbleSpring,
    readOpacity,
  ]);

  const finishReading = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    advancingRef.current = false;

    const result = await stopRecording();
    if (result.uri) {
      sampleUriRef.current = result.uri;
      setVoiceSample(result.uri, result.durationSec);
      setComplete(true);
      playCompleteEnter();
      // Sound plays later — only when clone finishes → "you’re all set".
      void startClone(result.uri);
      return;
    }

    setComplete(true);
    playCompleteEnter();
    setCloneError('Your recording didn’t save. Tap re-record to try again.');
    finishingRef.current = false;
  }, [playCompleteEnter, setVoiceSample, startClone, stopRecording]);

  const finishReadingRef = useRef(finishReading);
  finishReadingRef.current = finishReading;
  const linesLenRef = useRef(lines.length);
  linesLenRef.current = lines.length;
  const lineIndexRef = useRef(lineIndex);
  lineIndexRef.current = lineIndex;

  // Live STT signals as refs — interval must NOT restart on every meter tick.
  const spokenLiveRef = useRef(0);
  const wordCountLiveRef = useRef(0);
  const heardEnoughLiveRef = useRef(false);
  const quietLiveRef = useRef(true);
  const currentLineLiveRef = useRef(currentLine);
  const lineReadyLiveRef = useRef(false);
  spokenLiveRef.current = dictaphone.spokenCount;
  wordCountLiveRef.current = dictaphone.wordCount;
  heardEnoughLiveRef.current = dictaphone.lineHeardEnough;
  quietLiveRef.current = dictaphone.quiet;
  currentLineLiveRef.current = currentLine;

  const advanceLine = useCallback(() => {
    if (finishingRef.current) return false;
    if (advancingRef.current) return false;
    const fromIndex = lineIndexRef.current;
    if (doneLineRef.current === fromIndex) return false;

    // Mark in-flight only after we know we will move (rule: doneLine inside start).
    advancingRef.current = true;
    doneLineRef.current = fromIndex;
    void Haptics.selectionAsync().catch(() => {});

    if (fromIndex >= linesLenRef.current - 1) {
      advancingRef.current = false;
      void finishReadingRef.current();
      return true;
    }

    setLineIndex(fromIndex + 1);

    lineY.setValue(16);
    lineOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(lineOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lineY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      advancingRef.current = false;
    });
    // Watchdog — stuck advancingRef must not freeze the whole script.
    setTimeout(() => {
      advancingRef.current = false;
    }, 600);
    return true;
  }, [lineOpacity, lineY]);

  advanceLineRef.current = advanceLine;

  // Gate leftover STT from the previous chunk.
  useEffect(() => {
    advancingRef.current = false;
    setLineReady(false);
    lineReadyLiveRef.current = false;
    quietSinceRef.current = 0;
    lastSpokenCountRef.current = 0;
    lastSpokenAtRef.current = Date.now();
    const wait = lineIndex === 0 ? 40 : 80;
    const t = setTimeout(() => {
      setLineReady(true);
      lineReadyLiveRef.current = true;
    }, wait);
    return () => clearTimeout(t);
  }, [lineIndex]);

  useEffect(() => {
    lineReadyLiveRef.current = lineReady;
  }, [lineReady]);

  /**
   * Auto-advance after the chunk is heard (STT). Interval uses refs only —
   * deps are recording + complete so metering ticks don't recreate it.
   */
  useEffect(() => {
    if (!recording || complete) return;
    const id = setInterval(() => {
      if (!lineReadyLiveRef.current) return;
      if (advancingRef.current || finishingRef.current) return;
      const idx = lineIndexRef.current;
      if (doneLineRef.current === idx) return;

      const spoken = spokenLiveRef.current;
      const words = wordCountLiveRef.current;
      const line = currentLineLiveRef.current;
      const displayTotal = displayWords(line).length;
      const lit = spokenDisplayCount(line, spoken);
      const now = Date.now();

      if (spoken > lastSpokenCountRef.current) {
        lastSpokenCountRef.current = spoken;
        lastSpokenAtRef.current = now;
      }

      // Full match.
      if (words > 0 && spoken >= words) {
        advanceLineRef.current();
        return;
      }

      // Almost finished + quiet (STT often drops the last word).
      const almost =
        isLineFullyLit(line, spoken) ||
        (words >= 3 && spoken >= words - 1) ||
        (displayTotal >= 3 && lit >= displayTotal - 1) ||
        (words >= 5 && spoken / words >= 0.78);
      if (!almost) {
        quietSinceRef.current = 0;
        return;
      }

      const quietLongEnough =
        quietLiveRef.current || now - lastSpokenAtRef.current >= 480;
      if (!quietLongEnough) return;
      if (!quietSinceRef.current) quietSinceRef.current = now;
      if (now - quietSinceRef.current >= 280) {
        advanceLineRef.current();
      }
    }, 90);
    return () => clearInterval(id);
  }, [complete, recording]);

  // Quiet-time failsafe: heard something, then stalled → advance.
  useEffect(() => {
    if (!recording || complete) return;
    const id = setInterval(() => {
      if (!lineReadyLiveRef.current) return;
      if (advancingRef.current || finishingRef.current) return;
      const idx = lineIndexRef.current;
      if (doneLineRef.current === idx) return;
      const spoken = spokenLiveRef.current;
      const words = wordCountLiveRef.current;
      if (words < 2 || spoken < 1) return;
      if (spoken / Math.max(words, 1) < 0.45) return;
      const now = Date.now();
      if (now - lastSpokenAtRef.current < 1400) return;
      if (!quietLiveRef.current) return;
      // Hold the finished line for a beat so it reads as done, then move on.
      if (lineHoldRef.current === idx) return;
      lineHoldRef.current = idx;
      setTimeout(() => {
        if (lineIndexRef.current === idx) advanceLineRef.current();
      }, LINE_HOLD_MS);
    }, 200);
    return () => clearInterval(id);
  }, [complete, recording]);

  const leftRef = useRef(false);
  const leaveToVoicePreview = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      try {
        navigationRef.current.replace('VoicePreview');
      } catch {
        navigationRef.current.navigate('VoicePreview');
      }
    };
    // Same exit as Welcome: copy fades, the full-screen gold sheet retracts
    // upward and its bottom corners round off, then the next page.
    const fallback = setTimeout(go, 1300);
    Animated.timing(completeOpacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(goldSheetH, {
      toValue: 0,
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      clearTimeout(fallback);
      go();
    });
  }, [completeOpacity, goldSheetH]);
  const leaveToVoicePreviewRef = useRef(leaveToVoicePreview);
  leaveToVoicePreviewRef.current = leaveToVoicePreview;

  /**
   * "You’re all set" → leave after a short hold.
   * CRITICAL: deps are ONLY complete/cloneReady/cloneError. Putting
   * `navigation` (or leave callbacks) here cleared the timers every
   * re-render and left people stuck on gold forever.
   */
  useEffect(() => {
    if (!complete || !cloneReady || cloneError) {
      successLeaveArmedRef.current = false;
      return;
    }
    // Sound + spring once; the leave timers are set on every run so a
    // re-run of this effect can never leave the user parked on gold.
    if (!successLeaveArmedRef.current) {
      successLeaveArmedRef.current = true;
      playBubbleSpring();
      void playAllSetSound();
    }

    const go = () => leaveToVoicePreviewRef.current();
    const navAt = setTimeout(go, SUCCESS_HOLD_MS);
    const hard = setTimeout(go, SUCCESS_HOLD_MS + 1200);

    return () => {
      clearTimeout(navAt);
      clearTimeout(hard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot; leave via ref
  }, [cloneError, cloneReady, complete]);

  // Welcome-style spring when gold "cloning" sheet appears.
  useEffect(() => {
    if (!complete || cloneReady || cloneError) return;
    playBubbleSpring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, cloneReady, cloneError]);

  const rerecordFromComplete = async () => {
    if (!(await consentToRecord())) return;
    successLeaveArmedRef.current = false;
    leftRef.current = false;
    setComplete(false);
    finishingRef.current = false;
    cloneStartedRef.current = false;
    setCloneError(null);
    setCloneReady(false);
    resetCompleteVisuals();
    setLineIndex(0);
    lineHoldRef.current = -1;
    doneLineRef.current = -1;
    advancingRef.current = false;
    lineOpacity.setValue(1);
    lineY.setValue(0);
    void dictaphone.start();
  };

  const forceContinue = () => {
    if (!recording || complete) return;
    advancingRef.current = false;
    doneLineRef.current = -1;
    if (lineIndex >= lines.length - 1) {
      void finishReading();
      return;
    }
    const moved = advanceLine();
    if (!moved) {
      doneLineRef.current = lineIndex;
      setLineIndex((i) => (i >= lines.length - 1 ? i : i + 1));
      advancingRef.current = false;
    }
  };

  const onMicPress = async () => {
    if (dictaphone.status !== 'recording' && !(await consentToRecord(true))) {
      return;
    }
    if (complete) {
      if (cloneReady || cloning) return;
      successLeaveArmedRef.current = false;
      setComplete(false);
      finishingRef.current = false;
      cloneStartedRef.current = false;
      setCloneError(null);
      resetCompleteVisuals();
      setLineIndex(0);
      lineHoldRef.current = -1;
    lineHoldRef.current = -1;
      doneLineRef.current = -1;
      lineOpacity.setValue(1);
      lineY.setValue(0);
      advancingRef.current = false;
      await dictaphone.start();
      return;
    }
    if (dictaphone.status === 'recording') {
      void finishReading();
      return;
    }
    finishingRef.current = false;
    resetCompleteVisuals();
    setLineIndex(0);
    lineHoldRef.current = -1;
    doneLineRef.current = -1;
    lineOpacity.setValue(1);
    lineY.setValue(0);
    await dictaphone.start();
  };

  const retryClone = () => {
    const uri = sampleUriRef.current;
    if (!uri) return;
    cloneStartedRef.current = false;
    setCloneReady(false);
    void startClone(uri);
  };

  const skipForDev = () => {
    setVoiceId(getDefaultPremadeVoiceId(), true);
    markOnboardingComplete();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

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
      ? 'Read each line aloud at a calm, natural pace.'
      : null;

  return (
    <View style={styles.root}>
      {typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      VOICE_ONBOARDING_SKIP_ENABLED &&
      !complete ? (
        <Pressable
          accessibilityRole="button"
          onPress={skipForDev}
          style={styles.skipBtn}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.skipText}>skip → test alarm</Text>
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
          {/* Title + subtitle in ONE enter so left edges stay aligned (scale was shifting subtitle). */}
          <BubbleEnter delay={0} fromY={16}>
            <View>
              <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>{`Read this\nout loud`}</Text>
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.subtitle}>Find a quiet room.</Text>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: lines.length,
                  now: Math.min(lineIndex + 1, lines.length),
                }}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        ((lineIndex + (recording ? 0.35 : 0)) / lines.length) *
                          100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.progressLabel}>
                {Math.min(lineIndex + 1, lines.length)} of {lines.length}
              </Text>
            </View>
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

          {consentDeclined && !dictaphone.error ? (
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>
              To clone your voice, tap the mic and agree to send your recording to ElevenLabs.
            </Text>
          ) : null}
          {dictaphone.error ? (
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{dictaphone.error}</Text>
          ) : null}

          {coach ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.coach}>{coach}</Text> : null}

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
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.hint}>{hint}</Text>
              {recording ? (
                <TextArrowButton
                  label={
                    lineIndex >= lines.length - 1 ? 'finish' : 'continue'
                  }
                  color={accents.lime}
                  hideArrow
                  onPress={forceContinue}
                  style={styles.nextLineBtn}
                />
              ) : null}
            </View>
          </BubbleEnter>
        </Animated.View>
      </SafeAreaView>

      {/*
        Two layers on purpose: opacity/translate run on the native driver,
        height/corners on the JS driver. Mixing both drivers on one view
        crashed the app the moment "Voice cloned" was tapped.
      */}
      <Animated.View
        pointerEvents={complete ? 'box-none' : 'none'}
        style={[
          styles.goldPillLayer,
          {
            opacity: goldPillOpacity,
            transform: [{ translateY: goldPillY }],
          },
        ]}
      >
      <Animated.View
        pointerEvents={complete ? 'auto' : 'none'}
        style={[
          styles.goldPill,
          {
            height: goldSheetH,
            borderBottomLeftRadius: sheetRadius,
            borderBottomRightRadius: sheetRadius,
          },
        ]}
      >
        {/* Tap anywhere on success to leave — never trap the user again. */}
        <Pressable
          accessibilityRole="button"
          disabled={!cloneReady || Boolean(cloneError)}
          onPress={leaveToVoicePreview}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View
            style={[
              styles.completeInner,
              {
                opacity: completeOpacity,
                paddingTop: Math.max(insets.top, 48) + 32,
                paddingBottom: Math.max(insets.bottom, 16) + 20,
                transform: [
                  { translateY: completeEnterY },
                  { scale: completeEnterScale },
                ],
              },
            ]}
          >
            <View style={styles.completeCopy} pointerEvents="none">
              {cloning && !cloneReady ? <LogoSpinner /> : null}
              <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.completeTitle}>
                {cloneError
                  ? 'Almost'
                  : cloneReady
                    ? 'Voice cloned'
                    : 'Cloning your voice'}
              </Text>
              {cloneError ? (
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.completeError}>{cloneError}</Text>
              ) : cloneReady ? (
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.cloneEta}>
                  Your future self has your voice now.
                </Text>
              ) : (
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.cloneEta}>
                  This usually takes a minute or two
                </Text>
              )}
            </View>
            <View style={styles.completeFooter}>
              {cloneError ? (
                <>
                  <Pressable
                    onPress={rerecordFromComplete}
                    style={styles.goldLinkBtn}
                  >
                    <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.goldLinkText}>re-record</Text>
                  </Pressable>
                  <RoundArrowButton
                    onPress={() => {
                      if (/sign in/i.test(cloneError)) {
                        navigation.replace('SignIn', { mode: 'resume' });
                        return;
                      }
                      // No saved take → nothing to retry; record again.
                      if (!sampleUriRef.current) {
                        void rerecordFromComplete();
                        return;
                      }
                      retryClone();
                    }}
                    color={colors.bg}
                  />
                </>
              ) : (
                <View style={styles.footerPlaceholder} />
              )}
            </View>
          </Animated.View>
        </Pressable>
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
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    ...opticalLeft(40),
    lineHeight: 44,
    color: colors.text,
    marginBottom: 16,
    ...noFakeBold,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: 16,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(185, 173, 217, 0.3)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: accents.lilac,
  },
  progressLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 16,
    overflow: 'visible',
    minHeight: 72,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 16,
    paddingBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  nextLineBtn: {
    marginTop: 16,
    alignSelf: 'center',
  },
  error: {
    fontFamily: fonts.body,
    textAlign: 'center',
    color: accents.coral,
    marginBottom: spacing.sm,
  },
  coach: {
    fontFamily: fonts.body,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: 16,
  },
  goldPillLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  goldPill: {
    backgroundColor: COMPLETE_COLOR,
    overflow: 'hidden',
  },
  completeInner: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  completeCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  completeTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 56,
    textAlign: 'center',
    color: colors.text,
    ...noFakeBold,
  },
  cloneEta: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.8,
    paddingHorizontal: 16,
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
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  completeError: {
    fontFamily: fonts.body,
    fontSize: 15,
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

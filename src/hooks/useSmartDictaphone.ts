import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  isLineFullyLit,
  isLineHeardEnough,
  lineWordCount,
  matchedPrefixCount,
} from '../services/speechMatch';
import type { RecordingQualityStats } from '../services/recordingQuality';

export type DictaphoneStatus = 'idle' | 'recording' | 'stopped';

export type SmartDictaphoneOptions = {
  /** Fired the moment STT has heard enough of the current line — primary auto-advance path. */
  onLineComplete?: () => void;
};

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function contextualHints(line: string) {
  const words = line
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  // Bias Apple STT toward digit words that often get mangled
  const numberBias = [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    '4',
    '7',
  ];
  return [...words, ...numberBias].slice(0, 20);
}

export function useSmartDictaphone(
  currentLine: string,
  options?: SmartDictaphoneOptions
) {
  const [status, setStatus] = useState<DictaphoneStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [metering, setMetering] = useState(-40);
  const [spokenCount, setSpokenCount] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionReady, setRecognitionReady] = useState(false);

  const spokenRef = useRef(0);
  const lineRef = useRef(currentLine);
  const keepListeningRef = useRef(false);
  const finalsRef = useRef('');
  const lineGenRef = useRef(0);
  const uriWaiterRef = useRef<((uri: string) => void) | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const uriRef = useRef<string | null>(null);
  const usesNativePersistRef = useRef(false);
  const durationStartedAtRef = useRef(0);
  const acceptAfterRef = useRef(0);
  const lastMeterAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const onLineCompleteRef = useRef(options?.onLineComplete);
  onLineCompleteRef.current = options?.onLineComplete;
  const lineCompleteFiredRef = useRef(false);
  const peakVolumeRef = useRef(-2);
  const speechMsRef = useRef(0);
  const speechTickAtRef = useRef(0);
  const [quiet, setQuiet] = useState(true);

  lineRef.current = currentLine;

  useEffect(() => {
    spokenRef.current = 0;
    setSpokenCount(0);
    finalsRef.current = '';
    setHearing(false);
    setQuiet(true);
    lineGenRef.current += 1;
    lineCompleteFiredRef.current = false;
    // Brief ignore of leftover STT from the previous line.
    // Do NOT stop/restart recognition here — that froze karaoke advance on device.
    acceptAfterRef.current = Date.now() + 90;
    lastSpeechAtRef.current = 0;
  }, [currentLine]);

  useEffect(() => {
    try {
      setRecognitionReady(ExpoSpeechRecognitionModule.isRecognitionAvailable());
    } catch {
      setRecognitionReady(false);
    }
  }, []);

  const maybeFireLineComplete = useCallback((spoken: number, line: string) => {
    if (lineCompleteFiredRef.current) return;
    const words = lineWordCount(line);
    // Only when the line is essentially done — never on the first word(s).
    if (
      (words > 0 && spoken >= words) ||
      isLineFullyLit(line, spoken) ||
      isLineHeardEnough(spoken, words)
    ) {
      lineCompleteFiredRef.current = true;
      onLineCompleteRef.current?.();
    }
  }, []);

  const applyTranscript = useCallback(
    (heard: string, gen: number) => {
      if (gen !== lineGenRef.current) return;
      if (Date.now() < acceptAfterRef.current) return;
      const trimmed = heard.trim();
      if (!trimmed) return;
      const line = lineRef.current;
      const next = matchedPrefixCount(line, trimmed);
      if (next > spokenRef.current) {
        spokenRef.current = next;
        setSpokenCount(next);
        lastSpeechAtRef.current = Date.now();
        setHearing(true);
        setQuiet(false);
        maybeFireLineComplete(next, line);
      } else if (next > 0) {
        lastSpeechAtRef.current = Date.now();
        setHearing(true);
        setQuiet(false);
        maybeFireLineComplete(next, line);
      }
    },
    [maybeFireLineComplete]
  );

  const beginRecognition = useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      contextualStrings: contextualHints(lineRef.current),
      iosTaskHint: 'dictation',
      androidIntentOptions: {
        EXTRA_LANGUAGE_MODEL: 'free_form',
      },
      recordingOptions: usesNativePersistRef.current
        ? { persist: true }
        : undefined,
    });
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    if (!keepListeningRef.current) return;
    const results = event.results;
    if (!results?.length) return;
    const gen = lineGenRef.current;

    const chunk = results
      .map((item) => item?.transcript?.trim())
      .filter(Boolean)
      .join(' ');
    if (!chunk) return;

    if (event.isFinal) {
      finalsRef.current = `${finalsRef.current} ${chunk}`.trim();
      applyTranscript(finalsRef.current, gen);
      return;
    }
    applyTranscript(`${finalsRef.current} ${chunk}`.trim(), gen);
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    if (!keepListeningRef.current) return;
    if (typeof event.value !== 'number') return;
    // Throttle — unthrottled setState froze the waveform + UI on device.
    const now = Date.now();
    if (now - lastMeterAtRef.current < 120) return;
    const dt = lastMeterAtRef.current
      ? Math.min(now - lastMeterAtRef.current, 250)
      : 0;
    lastMeterAtRef.current = now;
    setMetering(event.value);
    if (event.value > peakVolumeRef.current) {
      peakVolumeRef.current = event.value;
    }
    // Apple volume is roughly -2…2. Higher speech floor → quiet sooner → auto-advance.
    if (event.value > 0.35) {
      lastSpeechAtRef.current = now;
      setQuiet(false);
      if (speechTickAtRef.current > 0) {
        speechMsRef.current += dt;
      }
      speechTickAtRef.current = now;
    } else if (
      lastSpeechAtRef.current > 0 &&
      now - lastSpeechAtRef.current > 320
    ) {
      setQuiet(true);
      setHearing(false);
      speechTickAtRef.current = 0;
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setHearing(false);
    if (!keepListeningRef.current) return;
    try {
      beginRecognition();
    } catch {
      /* restart race */
    }
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    if (!event.uri) return;
    uriRef.current = event.uri;
    setUri(event.uri);
    uriWaiterRef.current?.(event.uri);
    uriWaiterRef.current = null;
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    setHearing(false);
    if (event.error === 'not-allowed') {
      setError(
        'Allow microphone and speech recognition to use the dictaphone.'
      );
    } else if (event.error === 'service-not-allowed') {
      setError(
        'Turn on Siri & Dictation in Settings so Future Self can hear the script.'
      );
    } else if (event.message) {
      // Surface other errors so "not hearing" isn't silent.
      setError(event.message);
    }
  });

  const startAvRecording = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    if (recordingRef.current) {
      await recordingRef.current.stop().catch(() => undefined);
      recordingRef.current = null;
    }

    const recording = new AudioModule.AudioRecorder({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    await recording.prepareToRecordAsync();
    recording.record();
    recordingRef.current = recording;
  }, []);

  const stopAvRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return null;

    await recording.stop();
    const nextUri = recording.uri;
    recordingRef.current = null;

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    return nextUri;
  }, []);

  const requestPermission = useCallback(async (): Promise<{
    mic: boolean;
    speech: boolean;
  }> => {
    // Mic is required to clone. Speech is optional (karaoke) — do not block
    // recording if the user denies Speech Recognition.
    const mic = await requestRecordingPermissionsAsync();
    if (!mic.granted) {
      setError(
        'Microphone access is off. Turn it on in Settings → Future Self to record your voice.'
      );
      return { mic: false, speech: false };
    }

    let speech = false;
    const speechAvailable = (() => {
      try {
        return ExpoSpeechRecognitionModule.isRecognitionAvailable();
      } catch {
        return false;
      }
    })();

    if (speechAvailable) {
      try {
        const result =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        speech = Boolean(result.granted);
      } catch {
        speech = false;
      }
    }

    return { mic: true, speech };
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setUri(null);
      uriRef.current = null;
      setDurationMs(0);
      spokenRef.current = 0;
      setSpokenCount(0);
      setHearing(false);
      finalsRef.current = '';

      const { mic, speech } = await requestPermission();
      if (!mic) return;

      keepListeningRef.current = true;
      const speechOk =
        speech &&
        (() => {
          try {
            return ExpoSpeechRecognitionModule.isRecognitionAvailable();
          } catch {
            return false;
          }
        })();

      usesNativePersistRef.current =
        Platform.OS !== 'web' &&
        speechOk &&
        ExpoSpeechRecognitionModule.supportsRecording();

      // iOS: never dual-own the mic (AV + STT). Prefer STT+persist for both.
      if (usesNativePersistRef.current) {
        beginRecognition();
      } else if (Platform.OS === 'web') {
        try {
          beginRecognition();
        } catch {
          /* optional */
        }
        try {
          await startAvRecording();
        } catch {
          /* optional */
        }
      } else if (speechOk) {
        // STT without persist — karaoke only; also record AV for clone file.
        beginRecognition();
        try {
          await startAvRecording();
        } catch {
          /* STT owns mic */
        }
      } else {
        await startAvRecording();
        if (!speech) {
          setError(
            'Recording without live script check. Use Next line to continue.'
          );
        } else {
          setError('Speech recognition unavailable. Use Next line to continue.');
        }
      }

      durationStartedAtRef.current = Date.now();
      acceptAfterRef.current = Date.now() + 200;
      peakVolumeRef.current = -2;
      speechMsRef.current = 0;
      speechTickAtRef.current = 0;
      lineCompleteFiredRef.current = false;
      setStatus('recording');
    } catch (e) {
      keepListeningRef.current = false;
      setError(e instanceof Error ? e.message : 'Could not start recording');
      setStatus('idle');
    }
  }, [beginRecognition, requestPermission, startAvRecording]);

  const getQualityStats = useCallback((): RecordingQualityStats => {
    const durationSec = durationStartedAtRef.current
      ? Math.max(
          0,
          Math.floor((Date.now() - durationStartedAtRef.current) / 1000)
        )
      : Math.floor(durationMs / 1000);
    return {
      durationSec,
      peakVolume: peakVolumeRef.current,
      speechMs: speechMsRef.current,
    };
  }, [durationMs]);

  const stop = useCallback(async () => {
    keepListeningRef.current = false;

    try {
      const durationSec = durationStartedAtRef.current
        ? Math.max(
            0,
            Math.floor((Date.now() - durationStartedAtRef.current) / 1000)
          )
        : Math.floor(durationMs / 1000);

      if (ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          /* ignore */
        }
      }

      if (usesNativePersistRef.current && !uriRef.current) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            uriWaiterRef.current = null;
            resolve();
          }, 2500);
          uriWaiterRef.current = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      }

      let finalUri = uriRef.current;

      if (recordingRef.current) {
        const avUri = await stopAvRecording();
        if (avUri) {
          finalUri = avUri;
          uriRef.current = avUri;
          setUri(avUri);
        }
      }

      const finalDurationMs = durationStartedAtRef.current
        ? Date.now() - durationStartedAtRef.current
        : durationMs;
      setDurationMs(finalDurationMs);

      setStatus('stopped');
      setHearing(false);
      return {
        uri: finalUri,
        durationSec: Math.max(durationSec, Math.floor(finalDurationMs / 1000)),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
      setStatus('idle');
      return { uri: null, durationSec: 0 };
    }
  }, [durationMs, stopAvRecording]);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      recordingRef.current?.stop().catch(() => undefined);
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    status,
    uri,
    durationMs,
    durationLabel: formatMs(durationMs),
    durationSec: Math.floor(durationMs / 1000),
    metering,
    spokenCount,
    wordCount: lineWordCount(currentLine),
    lineHeardEnough: isLineHeardEnough(
      spokenCount,
      lineWordCount(currentLine)
    ),
    hearing,
    /** True when voice has settled — used to advance without cutting mid-sentence. */
    quiet,
    error,
    recognitionReady,
    requestPermission,
    start,
    stop,
    getQualityStats,
  };
}

import { Audio } from 'expo-av';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { lineWordCount, matchedPrefixCount } from '../services/speechMatch';

export type DictaphoneStatus = 'idle' | 'recording' | 'stopped';

export type RecordingTake = {
  uri: string | null;
  durationSec: number;
};

type Clock = {
  running: boolean;
  paused: boolean;
  baseMs: number;
  anchor: number;
};

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const idleClock = (): Clock => ({
  running: false,
  paused: false,
  baseMs: 0,
  anchor: 0,
});

export function useSmartDictaphone(currentLine: string) {
  const [status, setStatus] = useState<DictaphoneStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [metering, setMetering] = useState(-40);
  const [spokenCount, setSpokenCount] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionReady, setRecognitionReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [canPause, setCanPause] = useState(false);

  const spokenRef = useRef(0);
  const lineRef = useRef(currentLine);
  const keepListeningRef = useRef(false);
  const finalsRef = useRef('');
  const lineGenRef = useRef(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const uriRef = useRef<string | null>(null);
  const usesNativePersistRef = useRef(false);
  const durationMsRef = useRef(0);
  const clockRef = useRef<Clock>(idleClock());
  const uriWaiterRef = useRef<((uri: string | null) => void) | null>(null);

  lineRef.current = currentLine;

  const publishDuration = useCallback((ms: number) => {
    const next = Math.max(0, ms);
    durationMsRef.current = next;
    setDurationMs(next);
  }, []);

  const sampleElapsed = useCallback(() => {
    const clock = clockRef.current;
    if (!clock.running || clock.paused) return clock.baseMs;
    return clock.baseMs + (Date.now() - clock.anchor);
  }, []);

  const beginClock = useCallback(() => {
    clockRef.current = {
      running: true,
      paused: false,
      baseMs: 0,
      anchor: Date.now(),
    };
    setPaused(false);
    publishDuration(0);
  }, [publishDuration]);

  const pauseClock = useCallback(() => {
    const clock = clockRef.current;
    if (!clock.running) return clock.baseMs;
    if (!clock.paused) {
      clock.baseMs = sampleElapsed();
      clock.paused = true;
      setPaused(true);
    }
    publishDuration(clock.baseMs);
    return clock.baseMs;
  }, [publishDuration, sampleElapsed]);

  const resumeClock = useCallback(() => {
    const clock = clockRef.current;
    if (!clock.running || !clock.paused) return;
    clock.anchor = Date.now();
    clock.paused = false;
    setPaused(false);
  }, []);

  const freezeClock = useCallback(() => {
    const elapsed = sampleElapsed();
    clockRef.current = {
      running: false,
      paused: false,
      baseMs: elapsed,
      anchor: 0,
    };
    setPaused(false);
    publishDuration(elapsed);
    return elapsed;
  }, [publishDuration, sampleElapsed]);

  const clearClock = useCallback(() => {
    clockRef.current = idleClock();
    setPaused(false);
    publishDuration(0);
  }, [publishDuration]);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    const id = setInterval(() => {
      const clock = clockRef.current;
      if (!clock.running || clock.paused) return;
      publishDuration(sampleElapsed());
    }, 100);
    return () => clearInterval(id);
  }, [publishDuration, sampleElapsed, status]);

  useEffect(() => {
    spokenRef.current = 0;
    setSpokenCount(0);
    finalsRef.current = '';
    setHearing(false);
    lineGenRef.current += 1;
  }, [currentLine]);

  useEffect(() => {
    try {
      setRecognitionReady(ExpoSpeechRecognitionModule.isRecognitionAvailable());
    } catch {
      setRecognitionReady(false);
    }
  }, []);

  const applyTranscript = useCallback((heard: string, gen: number) => {
    if (gen !== lineGenRef.current) return;
    const trimmed = heard.trim();
    if (!trimmed) return;
    setHearing(true);
    const next = matchedPrefixCount(lineRef.current, trimmed);
    if (next > spokenRef.current) {
      spokenRef.current = next;
      setSpokenCount(next);
    }
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
    if (typeof event.value === 'number') {
      setMetering(event.value);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setHearing(false);
    if (!keepListeningRef.current) return;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
        recordingOptions: usesNativePersistRef.current
          ? { persist: true }
          : undefined,
      });
    } catch {
      /* restart race */
    }
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    const next = event.uri ?? null;
    if (next) {
      uriRef.current = next;
      setUri(next);
    }
    const waiter = uriWaiterRef.current;
    uriWaiterRef.current = null;
    waiter?.(next);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    setHearing(false);
    if (event.error === 'not-allowed') {
      setError(
        'Allow microphone and speech recognition to use the dictaphone.'
      );
    } else if (event.error === 'service-not-allowed') {
      setError(
        'Turn on Siri & Dictation in Settings so Future Self can hear the script.'
      );
    }
  });

  const waitForPersistedClip = useCallback((timeoutMs: number) => {
    if (uriRef.current) return Promise.resolve(uriRef.current);
    return new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (uriWaiterRef.current === finish) uriWaiterRef.current = null;
        resolve(value ?? uriRef.current);
      };
      const timer = setTimeout(() => finish(uriRef.current), timeoutMs);
      uriWaiterRef.current = finish;
      if (uriRef.current) finish(uriRef.current);
    });
  }, []);

  const startAvRecording = useCallback(async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });

    recording.setOnRecordingStatusUpdate((next) => {
      if (!next.isRecording) return;
      if (typeof next.metering === 'number') {
        setMetering(next.metering);
      }
    });

    await recording.startAsync();
    recordingRef.current = recording;
    setCanPause(true);
  }, []);

  const stopAvRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return null;

    await recording.stopAndUnloadAsync();
    const nextUri = recording.getURI();
    recordingRef.current = null;
    setCanPause(false);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    return nextUri;
  }, []);

  const startRecognition = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
        recordingOptions: usesNativePersistRef.current
          ? { persist: true }
          : undefined,
      });
    } catch (e) {
      if (Platform.OS !== 'web') throw e;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      if (ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const mic = await Audio.requestPermissionsAsync();
    if (!mic.granted) {
      setError('Microphone permission is required to clone your voice.');
      return false;
    }

    const speechAvailable = (() => {
      try {
        return ExpoSpeechRecognitionModule.isRecognitionAvailable();
      } catch {
        return false;
      }
    })();

    if (speechAvailable) {
      const speech = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!speech.granted) {
        setError(
          'Allow speech recognition so we can check you read the script correctly.'
        );
        return false;
      }
    }

    return true;
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setUri(null);
      uriRef.current = null;
      spokenRef.current = 0;
      setSpokenCount(0);
      setHearing(false);
      finalsRef.current = '';
      clearClock();
      setCanPause(false);

      const granted = await requestPermission();
      if (!granted) return;

      keepListeningRef.current = true;
      usesNativePersistRef.current =
        Platform.OS !== 'web' && ExpoSpeechRecognitionModule.supportsRecording();

      if (usesNativePersistRef.current) {
        await startRecognition();
      } else if (Platform.OS === 'web') {
        try {
          await startRecognition();
        } catch {
          /* Chrome may still record via expo-av */
        }
        try {
          await startAvRecording();
        } catch {
          /* speech recognition already owns the mic — karaoke still works */
        }
      } else {
        await startAvRecording();
        await startRecognition();
      }

      beginClock();
      setStatus('recording');
    } catch (e) {
      keepListeningRef.current = false;
      clearClock();
      setCanPause(false);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
        recordingRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* ignore */
      }
      setError(e instanceof Error ? e.message : 'Could not start recording');
      setStatus('idle');
    }
  }, [
    beginClock,
    clearClock,
    requestPermission,
    startAvRecording,
    startRecognition,
  ]);

  const stop = useCallback(async (): Promise<RecordingTake> => {
    keepListeningRef.current = false;
    const elapsed = freezeClock();

    try {
      stopRecognition();

      let finalUri = uriRef.current;

      if (recordingRef.current) {
        const avUri = await stopAvRecording();
        if (avUri) {
          finalUri = avUri;
          uriRef.current = avUri;
          setUri(avUri);
        }
      }

      if (!finalUri && usesNativePersistRef.current) {
        finalUri = await waitForPersistedClip(2500);
        if (finalUri) {
          uriRef.current = finalUri;
          setUri(finalUri);
        }
      }

      setStatus('stopped');
      setHearing(false);
      setCanPause(false);
      return {
        uri: finalUri,
        durationSec: Math.floor(elapsed / 1000),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
      setStatus('idle');
      setCanPause(false);
      return {
        uri: null,
        durationSec: Math.floor(elapsed / 1000),
      };
    }
  }, [freezeClock, stopAvRecording, stopRecognition, waitForPersistedClip]);

  const cancel = useCallback(async () => {
    keepListeningRef.current = false;
    clearClock();
    spokenRef.current = 0;
    setSpokenCount(0);
    finalsRef.current = '';
    setHearing(false);
    setCanPause(false);

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ignore */
    }

    if (recordingRef.current) {
      await stopAvRecording().catch(() => undefined);
    } else {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => undefined);
    }

    const waiter = uriWaiterRef.current;
    uriWaiterRef.current = null;
    waiter?.(null);

    uriRef.current = null;
    setUri(null);
    setStatus('stopped');
  }, [clearClock, stopAvRecording]);

  const pause = useCallback(async () => {
    if (!clockRef.current.running || clockRef.current.paused) return;
    if (!recordingRef.current) return;

    pauseClock();
    try {
      await recordingRef.current.pauseAsync();
    } catch {
      resumeClock();
      setError('This device can’t pause the recording. Keep going, or tap the mic to start over.');
    }
  }, [pauseClock, resumeClock]);

  const resume = useCallback(async () => {
    if (!clockRef.current.running || !clockRef.current.paused) return;
    const recording = recordingRef.current;
    if (!recording) {
      resumeClock();
      return;
    }

    try {
      await recording.startAsync();
      resumeClock();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resume recording');
    }
  }, [resumeClock]);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      clockRef.current = idleClock();
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
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
    hearing,
    error,
    recognitionReady,
    paused,
    canPause,
    requestPermission,
    start,
    stop,
    cancel,
    pause,
    resume,
  };
}

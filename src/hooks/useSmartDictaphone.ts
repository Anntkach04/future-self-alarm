import { Audio } from 'expo-av';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { lineWordCount, matchedPrefixCount } from '../services/speechMatch';

export type DictaphoneStatus = 'idle' | 'recording' | 'stopped';

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function useSmartDictaphone(currentLine: string) {
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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const uriRef = useRef<string | null>(null);
  const usesNativePersistRef = useRef(false);
  const durationStartedAtRef = useRef(0);

  lineRef.current = currentLine;

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
    if (!event.uri) return;
    uriRef.current = event.uri;
    setUri(event.uri);
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
      setDurationMs(next.durationMillis || 0);
      if (typeof next.metering === 'number') {
        setMetering(next.metering);
      }
    });

    await recording.startAsync();
    recordingRef.current = recording;
  }, []);

  const stopAvRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return null;

    await recording.stopAndUnloadAsync();
    const nextUri = recording.getURI();
    recordingRef.current = null;

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
      setDurationMs(0);
      spokenRef.current = 0;
      setSpokenCount(0);
      setHearing(false);
      finalsRef.current = '';

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

      durationStartedAtRef.current = Date.now();
      setStatus('recording');
    } catch (e) {
      keepListeningRef.current = false;
      setError(e instanceof Error ? e.message : 'Could not start recording');
      setStatus('idle');
    }
  }, [requestPermission, startAvRecording, startRecognition]);

  const stop = useCallback(async () => {
    keepListeningRef.current = false;

    try {
      if (ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          /* ignore */
        }
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

      if (durationStartedAtRef.current) {
        setDurationMs(Date.now() - durationStartedAtRef.current);
      }

      setStatus('stopped');
      setHearing(false);
      return finalUri;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
      setStatus('idle');
      return null;
    }
  }, [stopAvRecording]);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
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
    requestPermission,
    start,
    stop,
  };
}

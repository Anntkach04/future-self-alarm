import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { lineWordCount, matchedPrefixCount } from '../services/speechMatch';

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionCtor = new () => RecognitionInstance;

function getRecognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechFollowAlong(line: string, active: boolean) {
  const [spokenCount, setSpokenCount] = useState(0);
  const [hearing, setHearing] = useState(false);
  const spokenRef = useRef(0);
  const lineRef = useRef(line);
  const keepAliveRef = useRef(false);
  const lastHeardAtRef = useRef(0);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const resultAnchorRef = useRef(0);

  lineRef.current = line;

  const reset = useCallback(() => {
    spokenRef.current = 0;
    setSpokenCount(0);
    setHearing(false);
  }, []);

  useEffect(() => {
    spokenRef.current = 0;
    setSpokenCount(0);
    resultAnchorRef.current = -1;
  }, [line]);

  useEffect(() => {
    if (!active) {
      keepAliveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      setHearing(false);
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    keepAliveRef.current = true;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (resultAnchorRef.current < 0) {
        resultAnchorRef.current = Math.max(0, event.results.length - 1);
      }
      let heard = '';
      for (let i = resultAnchorRef.current; i < event.results.length; i += 1) {
        heard += `${event.results[i][0].transcript} `;
      }
      const next = matchedPrefixCount(lineRef.current, heard);
      if (next > spokenRef.current) {
        spokenRef.current = next;
        setSpokenCount(next);
        lastHeardAtRef.current = Date.now();
      }
      if (heard.trim()) setHearing(true);
    };

    recognition.onend = () => {
      setHearing(false);
      if (keepAliveRef.current) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };

    recognition.onerror = () => {
      setHearing(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }

    return () => {
      keepAliveRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [active]);

  const nudgeFromVoice = useCallback(
    (voiceDetected: boolean) => {
      if (!active || !voiceDetected) return;
      const total = lineWordCount(lineRef.current);
      if (spokenRef.current >= total) return;
      const recentlyHeard = Date.now() - lastHeardAtRef.current < 900;
      if (recentlyHeard) return;
      spokenRef.current += 1;
      lastHeardAtRef.current = Date.now();
      setSpokenCount(spokenRef.current);
    },
    [active]
  );

  return {
    spokenCount,
    hearing,
    wordCount: lineWordCount(line),
    reset,
    nudgeFromVoice,
    hasSpeechApi: Boolean(getRecognitionCtor()),
  };
}

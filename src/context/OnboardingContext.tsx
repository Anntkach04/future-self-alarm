import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { APP_STORAGE_KEYS } from '../services/resetApp';
import { WEEKDAYS } from './AlarmsContext';

const STORAGE_KEY = APP_STORAGE_KEYS.onboarding;

export type OnboardingAnswers = {
  name: string;
  morningFeelings: string[];
  futureSelf: string[];
  alreadyProud: string[];
  hardMornings: string[];
  voiceStyle: string | null;
  messageLength: string | null;
  musicBedId: string;
  wakeHour: number;
  wakeMinute: number;
  wakeDays: number[];
};

export type VoiceProfile = {
  sampleUri: string | null;
  sampleDurationSec: number;
  voiceId: string | null;
  previewUri: string | null;
  previewText: string | null;
  isDemo: boolean;
};

type OnboardingContextValue = {
  answers: OnboardingAnswers;
  voice: VoiceProfile;
  ready: boolean;
  onboardingComplete: boolean;
  setName: (name: string) => void;
  toggleMorningFeeling: (value: string) => void;
  addMorningFeeling: (value: string) => void;
  toggleFutureSelf: (value: string) => void;
  addFutureSelf: (value: string) => void;
  toggleAlreadyProud: (value: string) => void;
  addAlreadyProud: (value: string) => void;
  toggleHardMorning: (value: string) => void;
  addHardMorning: (value: string) => void;
  setVoiceStyle: (value: string) => void;
  setMessageLength: (value: string) => void;
  setMusicBedId: (value: string) => void;
  setWakeTime: (hour: number, minute: number) => void;
  setWakeDays: (days: number[]) => void;
  setVoiceSample: (uri: string, durationSec: number) => void;
  setVoiceId: (voiceId: string, isDemo?: boolean) => void;
  setPreview: (uri: string | null, text?: string | null) => void;
  clearVoice: () => void;
  markOnboardingComplete: () => void;
  resetOnboarding: () => Promise<void>;
};

const defaultAnswers: OnboardingAnswers = {
  name: '',
  morningFeelings: [],
  futureSelf: [],
  alreadyProud: [],
  hardMornings: [],
  voiceStyle: null,
  messageLength: 'About 30 seconds',
  musicBedId: 'bali-morning',
  wakeHour: 7,
  wakeMinute: 0,
  wakeDays: [...WEEKDAYS],
};

const defaultVoice: VoiceProfile = {
  sampleUri: null,
  sampleDurationSec: 0,
  voiceId: null,
  previewUri: null,
  previewText: null,
  isDemo: false,
};

function toggleInList(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function addToList(list: string[], value: string) {
  return list.includes(value) ? list : [...list, value];
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(defaultAnswers);
  const [voice, setVoice] = useState<VoiceProfile>(defaultVoice);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as {
            answers?: OnboardingAnswers;
            voice?: VoiceProfile;
            onboardingComplete?: boolean;
          };
          if (parsed.answers) {
            setAnswers({ ...defaultAnswers, ...parsed.answers });
          }
          if (parsed.voice) {
            setVoice({ ...defaultVoice, ...parsed.voice });
          }
          setOnboardingComplete(Boolean(parsed.onboardingComplete));
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, voice, onboardingComplete })
    ).catch(() => {});
  }, [answers, voice, onboardingComplete, ready]);

  const markOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    setAnswers(defaultAnswers);
    setVoice(defaultVoice);
    setOnboardingComplete(false);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      answers,
      voice,
      ready,
      onboardingComplete,
      markOnboardingComplete,
      resetOnboarding,
      setName: (name) => setAnswers((prev) => ({ ...prev, name })),
      toggleMorningFeeling: (value) =>
        setAnswers((prev) => ({
          ...prev,
          morningFeelings: toggleInList(prev.morningFeelings, value),
        })),
      addMorningFeeling: (value) =>
        setAnswers((prev) => ({
          ...prev,
          morningFeelings: addToList(prev.morningFeelings, value),
        })),
      toggleFutureSelf: (value) =>
        setAnswers((prev) => ({
          ...prev,
          futureSelf: toggleInList(prev.futureSelf, value),
        })),
      addFutureSelf: (value) =>
        setAnswers((prev) => ({
          ...prev,
          futureSelf: addToList(prev.futureSelf, value),
        })),
      toggleAlreadyProud: (value) =>
        setAnswers((prev) => ({
          ...prev,
          alreadyProud: toggleInList(prev.alreadyProud, value),
        })),
      addAlreadyProud: (value) =>
        setAnswers((prev) => ({
          ...prev,
          alreadyProud: addToList(prev.alreadyProud, value),
        })),
      toggleHardMorning: (value) =>
        setAnswers((prev) => ({
          ...prev,
          hardMornings: toggleInList(prev.hardMornings, value),
        })),
      addHardMorning: (value) =>
        setAnswers((prev) => ({
          ...prev,
          hardMornings: addToList(prev.hardMornings, value),
        })),
      setVoiceStyle: (value) =>
        setAnswers((prev) => ({
          ...prev,
          voiceStyle: prev.voiceStyle === value ? null : value,
        })),
      setMessageLength: (value) =>
        setAnswers((prev) => ({
          ...prev,
          messageLength: prev.messageLength === value ? null : value,
        })),
      setMusicBedId: (value) =>
        setAnswers((prev) => ({ ...prev, musicBedId: value })),
      setWakeTime: (hour, minute) =>
        setAnswers((prev) => ({ ...prev, wakeHour: hour, wakeMinute: minute })),
      setWakeDays: (days) =>
        setAnswers((prev) => ({ ...prev, wakeDays: [...days] })),
      setVoiceSample: (uri, durationSec) =>
        setVoice((prev) => ({
          ...prev,
          sampleUri: uri,
          sampleDurationSec: durationSec,
          voiceId: null,
          previewUri: null,
          previewText: null,
          isDemo: false,
        })),
      setVoiceId: (voiceId, isDemo = false) =>
        setVoice((prev) => ({ ...prev, voiceId, isDemo })),
      setPreview: (uri, text = null) =>
        setVoice((prev) => ({
          ...prev,
          previewUri: uri,
          previewText: text ?? prev.previewText,
        })),
      clearVoice: () => setVoice(defaultVoice),
    }),
    [answers, voice, ready, onboardingComplete, markOnboardingComplete, resetOnboarding]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}

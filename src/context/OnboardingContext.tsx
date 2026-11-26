import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TEMP_ELEVENLABS_TTS_ONLY } from '../config/devBypass';
import { getDefaultPremadeVoiceId } from '../services/defaultVoice';
import { APP_STORAGE_KEYS } from '../services/resetApp';
import { WEEKDAYS } from './AlarmsContext';

const STORAGE_KEY = APP_STORAGE_KEYS.onboarding;

/** Preset answers of the retired "What helps on hard mornings?" question. */
const OLD_HARD_MORNING_ANSWERS = new Set([
  'one step is enough.',
  "you're not behind.",
  'today can feel lighter.',
  'good things are coming.',
  'keep your promise to yourself.',
  'soft mornings still count.',
]);

/** asleep: turns it off and falls back asleep; snooze: snoozes again and again; phone: grabs the phone first; low: gets up but feels bad; fine: none. */
export type WakeStruggle = 'asleep' | 'snooze' | 'phone' | 'low' | 'fine';

export type OnboardingAnswers = {
  name: string;
  morningFeelings: string[];
  futureSelf: string[];
  morningHabits: string[];
  hardMornings: string[];
  voiceStyle: string | null;
  messageLength: string | null;
  musicBedId: string;
  /** Nature sound under the voice: 'sound-birds' | 'sound-waves' | 'sound-rain' | 'none'. */
  wakeSoundId: string;
  /** When each goal was last confirmed (ISO); goals get re-checked every couple of weeks. */
  goalChecks: Record<string, string>;
  /** What usually goes wrong after the alarm: shapes messages and the "are you up?" check. */
  wakeStruggle: WakeStruggle | null;
  /** Goals they marked as done, newest first: tomorrow's message can be proud of them. */
  goalsDone: { goal: string; date: string }[];
  /** End every wake message with "I'm counting now. Five… One. Up." */
  countdownEnding: boolean;
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
  toggleMorningHabit: (value: string) => void;
  addMorningHabit: (value: string) => void;
  toggleHardMorning: (value: string) => void;
  addHardMorning: (value: string) => void;
  setVoiceStyle: (value: string) => void;
  setMessageLength: (value: string) => void;
  setMusicBedId: (value: string) => void;
  setCountdownEnding: (value: boolean) => void;
  setWakeSoundId: (value: string) => void;
  /** 'keep' = still on it; 'done' = achieved (moves to goalsDone). */
  checkGoal: (goal: string, result: 'keep' | 'done') => void;
  setWakeStruggle: (value: WakeStruggle) => void;
  /** First time a goal is seen: start its re-check clock. */
  seedGoalChecks: (dates: Record<string, string>) => void;
  setWakeTime: (hour: number, minute: number) => void;
  setWakeDays: (days: number[]) => void;
  setVoiceSample: (uri: string, durationSec: number) => void;
  setVoiceId: (voiceId: string, isDemo?: boolean) => void;
  setPreview: (uri: string | null, text?: string | null) => void;
  clearVoice: () => void;
  markOnboardingComplete: () => void;
  resetOnboarding: () => Promise<void>;
  /** Restore answers + voiceId from server (sample audio stays local). */
  hydrateFromCloud: (input: {
    answers: Partial<OnboardingAnswers>;
    voiceId?: string | null;
    isDemoVoice?: boolean;
    onboardingComplete?: boolean;
  }) => void;
};

const defaultAnswers: OnboardingAnswers = {
  name: '',
  morningFeelings: [],
  futureSelf: [],
  morningHabits: [],
  hardMornings: [],
  voiceStyle: null,
  messageLength: 'About 30 seconds',
    musicBedId: 'soft-calm',
  countdownEnding: false,
  wakeSoundId: 'sound-birds',
  goalChecks: {},
  wakeStruggle: null,
  goalsDone: [],
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
    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2000);

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
            const rawAnswers = parsed.answers as OnboardingAnswers & {
              alreadyProud?: string[];
            };
            const next = { ...defaultAnswers, ...rawAnswers };
            // Migrated away from “already proud” → morning habits.
            if (
              (!next.morningHabits || next.morningHabits.length === 0) &&
              Array.isArray(rawAnswers.alreadyProud)
            ) {
              next.morningHabits = [];
            }
            delete (next as { alreadyProud?: string[] }).alreadyProud;
            // The question changed from "What helps on hard mornings?"
            // (affirmations) to "What gets you out of bed?". Old answers
            // would show up as odd custom chips and mislead the AI.
            if (Array.isArray(next.hardMornings)) {
              next.hardMornings = next.hardMornings.filter(
                (v) => !OLD_HARD_MORNING_ANSWERS.has(String(v).trim().toLowerCase())
              );
            }
            // bali bed removed — never keep it as the active under-voice track
            if (
              next.musicBedId === 'bali-morning' ||
              next.musicBedId === 'bali' ||
              next.musicBedId === 'yoga-air' ||
              next.musicBedId === 'soft-massage' ||
              next.musicBedId === 'light-water' ||
              next.musicBedId === 'warm-earth'
            ) {
              next.musicBedId = 'soft-calm';
            }
            setAnswers(next);
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
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!ready || !TEMP_ELEVENLABS_TTS_ONLY || voice.voiceId) return;
    setVoice((prev) => ({
      ...prev,
      voiceId: getDefaultPremadeVoiceId(),
      isDemo: true,
    }));
  }, [ready, voice.voiceId]);

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

  const hydrateFromCloud = useCallback(
    (input: {
      answers: Partial<OnboardingAnswers>;
      voiceId?: string | null;
      isDemoVoice?: boolean;
      onboardingComplete?: boolean;
    }) => {
      setAnswers((prev) => ({ ...prev, ...input.answers }));
      if (input.voiceId !== undefined) {
        setVoice((prev) => ({
          ...prev,
          voiceId: input.voiceId ?? null,
          isDemo: Boolean(input.isDemoVoice),
          // Cloud does not store the sample file.
          sampleUri: input.voiceId ? prev.sampleUri : null,
        }));
      }
      if (input.onboardingComplete !== undefined) {
        setOnboardingComplete(Boolean(input.onboardingComplete));
      }
    },
    []
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      answers,
      voice,
      ready,
      onboardingComplete,
      markOnboardingComplete,
      resetOnboarding,
      hydrateFromCloud,
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
      toggleMorningHabit: (value) =>
        setAnswers((prev) => ({
          ...prev,
          morningHabits: toggleInList(prev.morningHabits, value),
        })),
      addMorningHabit: (value) =>
        setAnswers((prev) => ({
          ...prev,
          morningHabits: addToList(prev.morningHabits, value),
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
      setCountdownEnding: (value) =>
        setAnswers((prev) => ({ ...prev, countdownEnding: value })),
      setWakeSoundId: (value) =>
        setAnswers((prev) => ({ ...prev, wakeSoundId: value })),
      checkGoal: (goal, result) =>
        setAnswers((prev) => {
          const now = new Date().toISOString();
          if (result === 'keep') {
            return { ...prev, goalChecks: { ...prev.goalChecks, [goal]: now } };
          }
          const { [goal]: _gone, ...rest } = prev.goalChecks ?? {};
          return {
            ...prev,
            futureSelf: prev.futureSelf.filter((g) => g !== goal),
            goalChecks: rest,
            goalsDone: [{ goal, date: now }, ...(prev.goalsDone ?? [])].slice(0, 20),
          };
        }),
      setWakeStruggle: (value) =>
        setAnswers((prev) => ({ ...prev, wakeStruggle: value })),
      seedGoalChecks: (dates) =>
        setAnswers((prev) => ({ ...prev, goalChecks: { ...dates, ...prev.goalChecks } })),
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
    [
      answers,
      voice,
      ready,
      onboardingComplete,
      markOnboardingComplete,
      resetOnboarding,
      hydrateFromCloud,
    ]
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

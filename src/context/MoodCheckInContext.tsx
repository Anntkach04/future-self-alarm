import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'fsa.mood_checkin.v1';

export type MoodCheckIn = {
  date: string;
  moodId: string;
  moodLabel: string;
  note: string;
  advice: string;
};

type MoodCheckInContextValue = {
  today: MoodCheckIn | null;
  history: MoodCheckIn[];
  ready: boolean;
  saveCheckIn: (entry: Omit<MoodCheckIn, 'date'>) => void;
  hydrateMood: (entry: MoodCheckIn | null) => void;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const MoodCheckInContext = createContext<MoodCheckInContextValue | null>(null);

export function MoodCheckInProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<MoodCheckIn[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2000);

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as { history?: MoodCheckIn[] };
          if (Array.isArray(parsed.history)) {
            setHistory(parsed.history.slice(0, 30));
          }
        }
      } catch {
        // ignore
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
    if (!ready) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ history: history.slice(0, 30) })
    ).catch(() => {});
  }, [history, ready]);

  const hydrateMood = useCallback((entry: MoodCheckIn | null) => {
    if (!entry?.date || !entry.moodId) return;
    setHistory((prev) => {
      const without = prev.filter((item) => item.date !== entry.date);
      return [entry, ...without].slice(0, 30);
    });
  }, []);

  const value = useMemo<MoodCheckInContextValue>(() => {
    const key = todayKey();
    return {
      history,
      ready,
      today: history.find((item) => item.date === key) ?? null,
      saveCheckIn: (entry) => {
        const next: MoodCheckIn = { ...entry, date: todayKey() };
        setHistory((prev) => {
          const without = prev.filter((item) => item.date !== next.date);
          return [next, ...without].slice(0, 30);
        });
      },
      hydrateMood,
    };
  }, [history, ready, hydrateMood]);

  return (
    <MoodCheckInContext.Provider value={value}>
      {children}
    </MoodCheckInContext.Provider>
  );
}

export function useMoodCheckIn() {
  const ctx = useContext(MoodCheckInContext);
  if (!ctx) {
    throw new Error('useMoodCheckIn must be used within MoodCheckInProvider');
  }
  return ctx;
}

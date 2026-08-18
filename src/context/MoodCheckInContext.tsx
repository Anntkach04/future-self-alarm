import React, { createContext, useContext, useMemo, useState } from 'react';

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
  saveCheckIn: (entry: Omit<MoodCheckIn, 'date'>) => void;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const MoodCheckInContext = createContext<MoodCheckInContextValue | null>(null);

export function MoodCheckInProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<MoodCheckIn[]>([]);

  const value = useMemo<MoodCheckInContextValue>(() => {
    const key = todayKey();
    return {
      history,
      today: history.find((item) => item.date === key) ?? null,
      saveCheckIn: (entry) => {
        const next: MoodCheckIn = { ...entry, date: todayKey() };
        setHistory((prev) => {
          const without = prev.filter((item) => item.date !== next.date);
          return [next, ...without];
        });
      },
    };
  }, [history]);

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

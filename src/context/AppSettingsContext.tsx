import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'fsa.app_settings.v1';

export type AppSettings = {
  /** ISO date — alarms stay cancelled until this day (exclusive end of pause). */
  pauseUntil: string | null;
  /** 0–1 relative bed level used when regenerating mix. */
  bedLevel: number;
  /** 0–1 relative voice level used when regenerating mix. */
  voiceLevel: number;
  /** Mornings the person tapped “I’m up”. */
  morningsKept: number;
  lastMorningDate: string | null;
  appleUserId: string | null;
  appleEmail: string | null;
  notificationsReady: boolean;
  /** Soft flag: JWT dead but local Home/alarms stay. */
  sessionNeedsReauth: boolean;
  sessionReauthReason: string | null;
};

type AppSettingsContextValue = AppSettings & {
  ready: boolean;
  setPauseDays: (days: number | null) => void;
  setMixLevels: (voiceLevel: number, bedLevel: number) => void;
  recordMorningKept: () => void;
  setAppleAccount: (userId: string, email?: string | null) => void;
  clearAppleAccount: () => void;
  setNotificationsReady: (ready: boolean) => void;
  setSessionReauth: (needs: boolean, reason?: string | null) => void;
  isPaused: boolean;
};

const defaults: AppSettings = {
  pauseUntil: null,
  bedLevel: 0.35,
  voiceLevel: 0.85,
  morningsKept: 0,
  lastMorningDate: null,
  appleUserId: null,
  appleEmail: null,
  notificationsReady: false,
  sessionNeedsReauth: false,
  sessionReauthReason: null,
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);
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
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          setSettings({ ...defaults, ...parsed });
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, ready]);

  const isPaused = Boolean(
    settings.pauseUntil && settings.pauseUntil > todayKey()
  );

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      ready,
      isPaused,
      setPauseDays: (days) =>
        setSettings((prev) => ({
          ...prev,
          pauseUntil: days && days > 0 ? addDaysIso(days) : null,
        })),
      setMixLevels: (voiceLevel, bedLevel) =>
        setSettings((prev) => ({
          ...prev,
          voiceLevel: Math.min(1, Math.max(0.2, voiceLevel)),
          bedLevel: Math.min(1, Math.max(0, bedLevel)),
        })),
      recordMorningKept: () => {
        const key = todayKey();
        setSettings((prev) => {
          if (prev.lastMorningDate === key) return prev;
          return {
            ...prev,
            morningsKept: prev.morningsKept + 1,
            lastMorningDate: key,
          };
        });
      },
      setAppleAccount: (userId, email = null) =>
        setSettings((prev) => ({
          ...prev,
          appleUserId: userId,
          appleEmail: email,
        })),
      clearAppleAccount: () =>
        setSettings((prev) => ({
          ...prev,
          appleUserId: null,
          appleEmail: null,
          sessionNeedsReauth: false,
          sessionReauthReason: null,
        })),
      setNotificationsReady: (notificationsReady) =>
        setSettings((prev) => ({ ...prev, notificationsReady })),
      setSessionReauth: (needs, reason = null) =>
        setSettings((prev) => ({
          ...prev,
          sessionNeedsReauth: needs,
          sessionReauthReason: needs ? reason : null,
        })),
    }),
    [settings, ready, isPaused]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return ctx;
}

export function useAppSettingsOptional() {
  return useContext(AppSettingsContext);
}

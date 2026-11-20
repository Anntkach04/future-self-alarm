import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export const WELCOME_BLUE = '#BADFFF';

type SplashChromeValue = {
  splashActive: boolean;
  setSplashActive: (active: boolean) => void;
};

const SplashChromeContext = createContext<SplashChromeValue | null>(null);

export function SplashChromeProvider({ children }: { children: React.ReactNode }) {
  const [splashActive, setSplashActiveState] = useState(false);
  const setSplashActive = useCallback((active: boolean) => {
    setSplashActiveState(active);
  }, []);
  const value = useMemo(
    () => ({ splashActive, setSplashActive }),
    [splashActive, setSplashActive]
  );
  return (
    <SplashChromeContext.Provider value={value}>
      {children}
    </SplashChromeContext.Provider>
  );
}

export function useSplashChrome() {
  const ctx = useContext(SplashChromeContext);
  if (!ctx) {
    return {
      splashActive: false,
      setSplashActive: () => undefined,
    };
  }
  return ctx;
}

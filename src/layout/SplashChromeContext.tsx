import React, { createContext, useContext, useMemo, useState } from 'react';

export const WELCOME_BLUE = '#BADFFF';

type SplashChromeValue = {
  splashActive: boolean;
  setSplashActive: (active: boolean) => void;
};

const SplashChromeContext = createContext<SplashChromeValue | null>(null);

export function SplashChromeProvider({ children }: { children: React.ReactNode }) {
  const [splashActive, setSplashActive] = useState(false);
  const value = useMemo(
    () => ({ splashActive, setSplashActive }),
    [splashActive]
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

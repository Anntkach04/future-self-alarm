import React, { createContext, useContext, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

export type LayoutInfo = {
  width: number;
  height: number;
  isTablet: boolean;
  isPhone: boolean;
  contentMaxWidth: number;
  horizontalPadding: number;
};

const LayoutContext = createContext<LayoutInfo | null>(null);

export const BREAKPOINTS = {
  phoneMax: 430,
  tabletMax: 834,
  tabletMin: 600,
} as const;

export function LayoutProvider({
  children,
  frameWidth,
  frameHeight,
}: {
  children: React.ReactNode;
  frameWidth?: number;
  frameHeight?: number;
}) {
  const window = useWindowDimensions();
  const width = frameWidth ?? window.width;
  const height = frameHeight ?? window.height;
  const isTablet = width >= BREAKPOINTS.tabletMin;
  const isPhone = !isTablet;

  const value = useMemo<LayoutInfo>(
    () => ({
      width,
      height,
      isTablet,
      isPhone,
      contentMaxWidth: isTablet ? 560 : BREAKPOINTS.phoneMax,
      horizontalPadding: isTablet ? 32 : 24,
    }),
    [width, height, isTablet]
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  const window = useWindowDimensions();
  if (ctx) return ctx;
  const isTablet = window.width >= BREAKPOINTS.tabletMin;
  return {
    width: window.width,
    height: window.height,
    isTablet,
    isPhone: !isTablet,
    contentMaxWidth: isTablet ? 560 : BREAKPOINTS.phoneMax,
    horizontalPadding: isTablet ? 32 : 24,
  };
}

import { Platform } from 'react-native';

export const fonts = {
  heading: 'InstrumentSerif_400Regular',
  headingRegular: 'InstrumentSerif_400Regular',
  headingItalic: 'InstrumentSerif_400Regular_Italic',
  headingBold: 'InstrumentSerif_400Regular',
  bodyLight: 'Inter_300Light',
  /** Body copy is Light: Regular reads heavy on cream. */
  body: 'Inter_300Light',
  /** Emphasis (buttons, short labels): Regular, never Medium. */
  bodyMedium: 'Inter_400Regular',
  bodySemiBold: 'Inter_400Regular',
} as const;

/**
 * Prevents browsers from synthetically bolding custom font files
 * (makes Instrument Serif / Inter look much heavier than Regular).
 */
export const noFakeBold =
  Platform.OS === 'web'
    ? ({
        fontWeight: '400' as const,
        fontSynthesis: 'none',
      } as const)
    : ({ fontWeight: '400' as const } as const);

/** Light Inter — inputs, placeholders, secondary copy. No synthetic bolding on web. */
export const noFakeLight =
  Platform.OS === 'web'
    ? ({
        fontWeight: '300' as const,
        fontSynthesis: 'none',
      } as const)
    : ({ fontWeight: '300' as const } as const);

/** Named accents still used for intro cards, splash, inputs */
export const accents = {
  sky: '#6B91FF',
  gold: '#FEC554',
  coral: '#E98D73',
  royal: '#4F7CFF',
  sage: '#8FBDB7',
  lime: '#B9F34A',
  sand: '#D8C29E',
  mist: '#ADDEFF',
  ink: '#1A1A1A',
  /** Delete / destructive actions only — never a normal CTA. */
  danger: '#FF5A4E',
  /** Tonal buttons: one shade deeper than the card they sit on, ink label. */
  goldDeep: '#F2AE3D',
  mistDeep: '#7FC6F4',
  /** Soft lilac: progress bars. */
  lilac: '#B9ADD9',
} as const;

/** Soft chips / bubbles — Figma muted + extras that fit cream UI */
export const mutedPalette = [
  '#ADDEFF', // pale sky
  '#8FBDB7', // dusty teal
  '#AFC9A8', // sage olive
  '#B9ADD9', // soft lilac
  '#D8C29E', // sand
  '#E98D73', // terracotta
  '#EDB28C', // peach
  '#C9B8A8', // warm taupe (extra)
  '#A8B8D0', // dusty periwinkle (extra)
  '#CDB5C4', // muted rose (extra)
  '#B5C9BE', // mist green (extra)
  '#D4C4A8', // soft oat (extra)
] as const;

/** Bright accents — FABs / primary buttons */
export const brightPalette = [
  '#4F7CFF',
  '#FEC554',
  '#B9F34A',
  '#2FD6C8',
  '#6FE7C8',
  '#7E6BFF',
  '#FF6B5E',
  '#FF7FB5',
  '#FF9A3C',
  '#FFD84D',
  '#AEE1FF',
] as const;

/** @deprecated prefer mutedPalette — kept for any leftover imports */
export const bubblePalette = mutedPalette;

/** Stable “random” pick from muted palette (same index → same color). */
export function mutedColorAt(index: number): string {
  return mutedPalette[((index % mutedPalette.length) + mutedPalette.length) % mutedPalette.length];
}

/** Hash a string into a muted chip color (custom options stay consistent). */
export function mutedColorForLabel(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i += 1) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  return mutedPalette[h % mutedPalette.length];
}

/** #1A1A1A at 70% — strokes, borders, arrows */
export const inkStroke = 'rgba(26, 26, 26, 0.7)';

export const colors = {
  bg: '#FFFAEE',
  text: accents.ink,
  /** Secondary text: ink at 80%, never a separate gray. */
  textMuted: 'rgba(26, 26, 26, 0.8)',
  textSoft: 'rgba(26, 26, 26, 0.8)',
  border: inkStroke,
  chip: '#F3EBD3',
  chipSelected: accents.ink,
  chipSelectedText: '#FFFAEE',
  inputBg: '#FFFFFF',
  placeholder: '#B0A894',
  overlay: 'rgba(255,250,238,0.82)',
  imagePlaceholder: '#E8E0C8',
  dot: accents.ink,
  dotInactive: 'transparent',
  dotBorder: inkStroke,
  stage: '#FFFAEE',
  stroke: inkStroke,
  arrow: inkStroke,
  fab: '#AEE1FF',
};

/**
 * Spacing grid: multiples of 8; 4 only for tight pairs (icon + label).
 * Allowed: 4, 8, 16, 24, 32, 40, 48, 56, 64.
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 16,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** Side margin on every screen (one value app-wide). */
  inset: 24,
  /** Gap between the safe area and the first element (back / menu). */
  screenTop: 16,
  /** Extra top gap on mobile web — Safari chrome reports 0 safe-area. */
  webTop: Platform.OS === 'web' ? 20 : 0,
};

/**
 * Type scale — the only sizes in the app (size / line height):
 * display 48/56 · title1 40/44 · title2 28/32 · title3 22/28 ·
 * body 17/24 · subhead 15/20 · footnote 13/16.
 * Serif (Instrument) for display/titles, Inter for the rest.
 */
export const typeScale = {
  display: { fontSize: 48, lineHeight: 56 },
  title1: { fontSize: 40, lineHeight: 44 },
  title2: { fontSize: 28, lineHeight: 32 },
  title3: { fontSize: 22, lineHeight: 28 },
  body: { fontSize: 17, lineHeight: 24 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 16 },
} as const;

/**
 * Instrument Serif glyphs carry ~3.5% of the size as built-in left space
 * (0, G, S, d…), so big serif lines look indented next to Inter text at the
 * same x. Pull them back by that amount so edges line up optically.
 */
export function opticalLeft(fontSize: number) {
  return { marginLeft: -Math.round(fontSize * 0.035) };
}

/** Instrument Serif glyphs clip when line-height is tight or overflow is hidden. */
export const headingClipFix =
  Platform.OS === 'web'
    ? ({
        overflow: 'visible' as const,
        paddingTop: 8,
      } as const)
    : ({ overflow: 'visible' as const } as const);

export const radii = {
  input: 999,
  chip: 999,
  button: 999,
  card: 24,
  screen: 60,
};

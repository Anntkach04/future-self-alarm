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

/**
 * THE palette. Calm, earthy, one colour per hue: never add a second orange,
 * a lighter blue, etc. Every fill in the app comes from here
 * (docs/palette.md shows them all).
 */
export const earth = {
  blue: '#A9C3D8',
  teal: '#9CC0B5',
  /** Positive / success. */
  green: '#A8C294',
  /** Primary buttons. */
  gold: '#E8C276',
  orange: '#DFA07C',
  /** Delete / cancel / destructive only. */
  red: '#C46B5D',
  rose: '#D6AEB1',
  lilac: '#B8AFD3',
  tan: '#CBB792',
  /** The one beige for neutral fills (chips, inputs, "None", cards). */
  beige: '#F1E9D5',
} as const;

/** Named accents (old names kept so screens did not have to change). */
export const accents = {
  sky: earth.blue,
  gold: earth.gold,
  coral: earth.orange,
  royal: earth.blue,
  sage: earth.green,
  lime: earth.green,
  sand: earth.tan,
  mist: earth.blue,
  ink: '#1A1A1A',
  /** Delete / destructive actions only — never a normal CTA. */
  danger: earth.red,
  /** Buttons that sit on a coloured card: a cream pill (no darker shades). */
  goldDeep: '#FFFAEE',
  mistDeep: '#FFFAEE',
  lilac: earth.lilac,
} as const;

/** Soft chips / bubbles / tiles: the coloured hues of `earth`. */
export const mutedPalette = [
  earth.blue,
  earth.teal,
  earth.green,
  earth.lilac,
  earth.tan,
  earth.orange,
  earth.rose,
  earth.gold,
] as const;

/** Old "bright" slots, now the same earth hues (no neon). */
export const brightPalette = [
  earth.blue,
  earth.gold,
  earth.green,
  earth.teal,
  earth.teal,
  earth.lilac,
  earth.red,
  earth.rose,
  earth.orange,
  earth.gold,
  earth.blue,
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
  chip: earth.beige,
  chipSelected: accents.ink,
  chipSelectedText: '#FFFAEE',
  inputBg: '#FFFFFF',
  placeholder: '#B0A894',
  overlay: 'rgba(255,250,238,0.82)',
  imagePlaceholder: earth.beige,
  dot: accents.ink,
  dotInactive: 'transparent',
  dotBorder: inkStroke,
  stage: '#FFFAEE',
  stroke: inkStroke,
  arrow: inkStroke,
  fab: earth.blue,
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
/**
 * One chip size everywhere (onboarding questions, profile edit, Account
 * summary): 12 + 20 + 12 = 44 pt tall, 15 pt label, 16 pt between rows.
 */
export const chipMetrics = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  lineHeight: 20,
  rowGap: 16,
  columnGap: 8,
} as const;

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

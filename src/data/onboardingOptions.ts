const ink = '#1A1A1A';

export type BubbleOption = {
  id?: string;
  label: string;
  color: string;
  text: string;
  caption?: string;
  /** Extra shift on the row (px). Positive = right. */
  nudge?: number;
  /** Force row alignment when laid out alone. */
  align?: 'left' | 'right' | 'center';
};

function bubble(
  label: string,
  color: string,
  extras?: Partial<Pick<BubbleOption, 'caption' | 'id' | 'nudge' | 'align'>>
): BubbleOption {
  return { label, color, text: ink, ...extras };
}

/** Mood-matched — max ~6, staggered for cloud layout. */
export const MORNING_FEELING_OPTIONS: BubbleOption[] = [
  bubble('Calm & grounded', '#8FBDB7', { align: 'left', nudge: 0 }),
  bubble('Light & happy', '#FEC554', { align: 'right', nudge: -8 }),
  bubble('Strong & focused', '#E98D73', { align: 'left', nudge: 36 }),
  bubble('Loved & safe', '#E8A8C0', { align: 'right', nudge: 0 }),
  bubble('Proud of myself', '#B9ADD9', { align: 'left', nudge: 12 }),
  bubble('Soft & unhurried', '#EDB28C', { align: 'right', nudge: -20 }),
];

export const FUTURE_SELF_OPTIONS: BubbleOption[] = [
  bubble('Build a morning routine', '#8FBDB7', { align: 'left', nudge: 0 }),
  bubble('Have more energy', '#ADDEFF', { align: 'right', nudge: 0 }),
  bubble('Work on my own project', '#FEC554', { align: 'left', nudge: 28 }),
  bubble('Move my body', '#B9F34A', { align: 'right', nudge: -12 }),
  bubble('Have quiet time for myself', '#FF7FB5', { align: 'left', nudge: 8 }),
  bubble('Feel less rushed', '#D8C29E', { align: 'right', nudge: -4 }),
];

/** Morning rituals — remind what they set out to do after waking. */
export const MORNING_HABIT_OPTIONS: BubbleOption[] = [
  bubble('Morning workout', '#B9F34A', { align: 'left', nudge: 0 }),
  bubble('Protein breakfast', '#FEC554', { align: 'right', nudge: -8 }),
  bubble('Journaling', '#ADDEFF', { align: 'left', nudge: 28 }),
  bubble('Drink water first', '#8FBDB7', { align: 'right', nudge: 0 }),
  bubble('Make the bed', '#EDB28C', { align: 'left', nudge: 12 }),
  bubble('No phone for 20 min', '#B9ADD9', { align: 'right', nudge: -16 }),
];

export const HARD_MORNING_OPTIONS: BubbleOption[] = [
  bubble('One step is enough.', '#B9F34A', { align: 'left', nudge: 0 }),
  bubble("You're not behind.", '#D8C29E', { align: 'right', nudge: -8 }),
  bubble('Today can feel lighter.', '#EDB28C', { align: 'left', nudge: 32 }),
  bubble('Good things are coming.', '#FEC554', { align: 'right', nudge: 0 }),
  bubble('Keep your promise to yourself.', '#8FBDB7', {
    align: 'left',
    nudge: 16,
  }),
  bubble('Soft mornings still count.', '#ADDEFF', {
    align: 'right',
    nudge: -4,
  }),
];

export const VOICE_STYLE_OPTIONS: BubbleOption[] = [
  bubble('Warm, almost a whisper', '#EDB28C', { align: 'left', nudge: 0 }),
  bubble('Calm & confident', '#ADDEFF', { align: 'right', nudge: 0 }),
  bubble('Like my best friend', '#FEC554', { align: 'left', nudge: 24 }),
  bubble('Gentle coach', '#AFC9A8', { align: 'right', nudge: -12 }),
  bubble('Bright & smiling', '#B9F34A', { align: 'left', nudge: 8 }),
  bubble('Wise & unhurried', '#B9ADD9', { align: 'right', nudge: 0 }),
];

export const MESSAGE_LENGTH_OPTIONS: BubbleOption[] = [
  bubble('About 30 seconds', '#ADDEFF', { caption: 'one calm morning letter' }),
];

export const MUSIC_BED_OPTIONS: BubbleOption[] = [
  bubble('Soft calm', '#AFC9A8', {
    caption: 'quiet modern pad',
    id: 'soft-calm',
  }),
];

/** Brighter plus chip */
export const ADD_CHIP_COLOR = '#FFD84D';

export const INTRO_SLIDES = [
  {
    label: '',
    title: 'Wake up to your\nfuture self',
    body: 'No random ringtone.\nJust your own voice.',
    card: 'sky' as const,
  },
  {
    label: '',
    title: 'Read for\none minute',
    body: 'Read a short script aloud.\nWe turn it into your voice.',
    card: 'coral' as const,
  },
  {
    label: '',
    title: 'Hear yourself\ntomorrow morning',
    body: 'A new note every day,\nin your own voice.',
    card: 'gold' as const,
  },
];

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

export const ALREADY_YOU_OPTIONS: BubbleOption[] = [
  bubble('I start even when scared', '#E98D73', { align: 'left', nudge: 4 }),
  bubble("I'm gentle with myself", '#EDB28C', { align: 'right', nudge: 0 }),
  bubble('I keep showing up', '#8FBDB7', { align: 'left', nudge: 40 }),
  bubble('I trust my own pace', '#D8C29E', { align: 'right', nudge: -16 }),
  bubble('I rest without guilt', '#AFC9A8', { align: 'left', nudge: 0 }),
  bubble('I choose myself', '#FEC554', { align: 'right', nudge: 8 }),
];

export const HARD_MORNING_OPTIONS: BubbleOption[] = [
  bubble('You are enough.', '#ADDEFF', { align: 'left', nudge: 0 }),
  bubble('One step is enough.', '#B9F34A', { align: 'right', nudge: -8 }),
  bubble("You're not behind.", '#D8C29E', { align: 'left', nudge: 32 }),
  bubble('Today can feel lighter.', '#EDB28C', { align: 'right', nudge: 0 }),
  bubble('Good things are coming.', '#FEC554', { align: 'left', nudge: 16 }),
  bubble('Keep your promise to yourself.', '#8FBDB7', {
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
  bubble('Bali morning', '#EDB28C', { caption: 'warm air', id: 'bali-morning' }),
  bubble('Yoga air', '#ADDEFF', { caption: 'open & light', id: 'yoga-air' }),
  bubble('Soft massage', '#AFC9A8', {
    caption: 'slow & round',
    id: 'soft-massage',
  }),
  bubble('Light water', '#B9ADD9', { caption: 'quiet flow', id: 'light-water' }),
  bubble('Warm earth', '#D8C29E', { caption: 'grounded', id: 'warm-earth' }),
];

/** Brighter plus chip */
export const ADD_CHIP_COLOR = '#FFD84D';

export const INTRO_SLIDES = [
  {
    label: '',
    title: 'Wake up\nto your\nFuture Self',
    body: 'No random ringtone.\nYour own voice.\nEvery morning.',
    card: 'sky' as const,
  },
  {
    label: '',
    title: 'Stay on\nTrack',
    body: 'A small reminder.\nExactly when you need it.',
    card: 'coral' as const,
  },
  {
    label: '',
    title: 'Keep\nmoving\nforward',
    body: 'The future you want\nstarts today.\nOne morning at a time.',
    card: 'gold' as const,
  },
];

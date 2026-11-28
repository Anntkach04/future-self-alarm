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
  bubble('Calm & grounded', '#9CC0B5', { align: 'left', nudge: 0 }),
  bubble('Light & happy', '#E8C276', { align: 'right', nudge: -8 }),
  bubble('Strong & focused', '#DFA07C', { align: 'left', nudge: 36 }),
  bubble('Loved & safe', '#D6AEB1', { align: 'right', nudge: 0 }),
  bubble('Proud of myself', '#B8AFD3', { align: 'left', nudge: 12 }),
  bubble('Soft & unhurried', '#DFA07C', { align: 'right', nudge: -20 }),
];

export const FUTURE_SELF_OPTIONS: BubbleOption[] = [
  bubble('Build a morning routine', '#9CC0B5', { align: 'left', nudge: 0 }),
  bubble('Have more energy', '#A9C3D8', { align: 'right', nudge: 0 }),
  bubble('Work on my own project', '#E8C276', { align: 'left', nudge: 28 }),
  bubble('Move my body', '#A8C294', { align: 'right', nudge: -12 }),
  bubble('Have quiet time for myself', '#D6AEB1', { align: 'left', nudge: 8 }),
  bubble('Feel less rushed', '#CBB792', { align: 'right', nudge: -4 }),
];

/** Morning rituals — remind what they set out to do after waking. */
export const MORNING_HABIT_OPTIONS: BubbleOption[] = [
  bubble('Morning workout', '#A8C294', { align: 'left', nudge: 0 }),
  bubble('Protein breakfast', '#E8C276', { align: 'right', nudge: -8 }),
  bubble('Journaling', '#A9C3D8', { align: 'left', nudge: 28 }),
  bubble('Drink water first', '#9CC0B5', { align: 'right', nudge: 0 }),
  bubble('Make the bed', '#DFA07C', { align: 'left', nudge: 12 }),
  bubble('No phone for 20 min', '#B8AFD3', { align: 'right', nudge: -16 }),
];

/** What gets you out of bed (stored as `hardMornings`, kept for old data). */
export const HARD_MORNING_OPTIONS: BubbleOption[] = [
  bubble('Coffee or tea', '#DFA07C', { align: 'left', nudge: 0 }),
  bubble('Music', '#A9C3D8', { align: 'right', nudge: -8 }),
  bubble('Sunlight', '#E8C276', { align: 'left', nudge: 32 }),
  bubble('A plan for the day', '#9CC0B5', { align: 'right', nudge: 0 }),
  bubble('People I love', '#B8AFD3', { align: 'left', nudge: 16 }),
  bubble('Something to look forward to', '#A8C294', {
    align: 'right',
    nudge: -4,
  }),
];

/** After the alarm goes off (stored as `wakeStruggle`). Single choice. */
export const WAKE_STRUGGLE_OPTIONS: (BubbleOption & { value: WakeStruggleValue })[] = [
  { ...bubble('I fall back asleep', '#B8AFD3', { align: 'left', nudge: 0 }), value: 'asleep' },
  { ...bubble('I snooze again and again', '#DFA07C', { align: 'right', nudge: -8 }), value: 'snooze' },
  { ...bubble('I grab my phone', '#9CC0B5', { align: 'left', nudge: 24 }), value: 'phone' },
  { ...bubble('I get up but feel low', '#A9C3D8', { align: 'right', nudge: 0 }), value: 'low' },
  { ...bubble('Mornings are fine', '#A8C294', { align: 'left', nudge: 12 }), value: 'fine' },
];

type WakeStruggleValue = 'asleep' | 'snooze' | 'phone' | 'low' | 'fine';

export const VOICE_STYLE_OPTIONS: BubbleOption[] = [
  bubble('Warm, almost a whisper', '#DFA07C', { align: 'left', nudge: 0 }),
  bubble('Calm & confident', '#A9C3D8', { align: 'right', nudge: 0 }),
  bubble('Like my best friend', '#E8C276', { align: 'left', nudge: 24 }),
  bubble('Gentle coach', '#A8C294', { align: 'right', nudge: -12 }),
  bubble('Bright & smiling', '#A8C294', { align: 'left', nudge: 8 }),
  bubble('Wise & unhurried', '#B8AFD3', { align: 'right', nudge: 0 }),
];

export const MESSAGE_LENGTH_OPTIONS: BubbleOption[] = [
  bubble('About 30 seconds', '#A9C3D8', { caption: 'one calm morning letter' }),
];

export const MUSIC_BED_OPTIONS: BubbleOption[] = [
  bubble('Soft calm', '#A8C294', {
    caption: 'quiet modern pad',
    id: 'soft-calm',
  }),
];

/** Brighter plus chip */
export const ADD_CHIP_COLOR = '#E8C276';

/** What it is, what it does, what you get. Titles 2 lines, bodies 2 short lines. */
export const INTRO_SLIDES = [
  {
    label: '',
    title: 'An alarm that\nsounds like you',
    body: 'Your own voice wakes you,\nnot a ringtone.',
    card: 'sky' as const,
  },
  {
    label: '',
    title: 'A new message\nevery morning',
    body: 'Fresh words every day,\nshaped by your goals.',
    card: 'coral' as const,
  },
  {
    label: '',
    title: 'Start your day\nwith a reason',
    body: 'Wake up calmer,\nreminded why you rise.',
    card: 'gold' as const,
  },
];

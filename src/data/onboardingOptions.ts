const ink = '#1A1A1A';

export type BubbleOption = {
  id?: string;
  label: string;
  color: string;
  text: string;
  caption?: string;
  /** Shift chip right in the cloud layout (px). */
  nudgeRight?: number;
};

function bubble(
  label: string,
  color: string,
  caption?: string,
  id?: string
): BubbleOption {
  return { label, color, text: ink, caption, id };
}

/** Mood-matched, no repeats — each chip gets its own colour. */
export const MORNING_FEELING_OPTIONS: BubbleOption[] = [
  bubble('Calm & grounded', '#8FBDB7'),
  bubble('Light & happy', '#FEC554'),
  bubble('Strong & focused', '#E98D73'),
  bubble('Loved & safe', '#E8A8C0'),
  bubble('Proud of myself', '#B9ADD9'),
  bubble('Full of energy', '#B9F34A'),
  bubble('Soft & unhurried', '#EDB28C'),
  bubble('Inspired to create', '#6B91FF'),
];

export const FUTURE_SELF_OPTIONS: BubbleOption[] = [
  bubble('Build a morning routine', '#8FBDB7'),
  bubble('Have more energy', '#ADDEFF'),
  bubble('Work on my own project', '#FEC554'),
  bubble('Move my body', '#B9F34A'),
  bubble('Read before the day starts', '#AFC9A8'),
  bubble('Meditate or breathe', '#EDB28C'),
  bubble('Have quiet time for myself', '#FF7FB5'),
  bubble('Get ahead of my to-do list', '#7E9BFF'),
  bubble('Feel less rushed', '#D8C29E'),
  bubble('Invest in my growth', '#C5E86A'),
];

export const ALREADY_YOU_OPTIONS: BubbleOption[] = [
  bubble('I start even when scared', '#E98D73'),
  bubble("I'm gentle with myself", '#EDB28C'),
  bubble('I make space to create', '#B9ADD9'),
  bubble('I keep showing up', '#8FBDB7'),
  bubble('I trust my own pace', '#D8C29E'),
  bubble('I deserve peace', '#ADDEFF'),
  bubble('I rest without guilt', '#AFC9A8'),
  bubble('I choose myself', '#FEC554'),
];

export const HARD_MORNING_OPTIONS: BubbleOption[] = [
  bubble('You are enough.', '#ADDEFF'),
  bubble('One step is enough.', '#B9F34A'),
  bubble('You are loved as you are.', '#E8A8C0'),
  bubble("You're not behind.", '#D8C29E'),
  bubble('Today can feel lighter.', '#EDB28C'),
  bubble('Your body is home.', '#AFC9A8'),
  bubble('Good things are coming.', '#FEC554'),
  bubble('Keep your promise to yourself.', '#8FBDB7'),
];

export const VOICE_STYLE_OPTIONS: BubbleOption[] = [
  bubble('Warm, almost a whisper', '#EDB28C'),
  bubble('Calm & confident', '#ADDEFF'),
  bubble('Like my best friend', '#FEC554'),
  bubble('Gentle coach', '#AFC9A8'),
  bubble('Bright & smiling', '#B9F34A'),
  bubble('Wise & unhurried', '#B9ADD9'),
];

export const MESSAGE_LENGTH_OPTIONS: BubbleOption[] = [
  bubble('About 30 seconds', '#ADDEFF', 'one calm morning letter'),
];

export const MUSIC_BED_OPTIONS: BubbleOption[] = [
  bubble('Bali morning', '#EDB28C', 'warm air', 'bali-morning'),
  bubble('Yoga air', '#ADDEFF', 'open & light', 'yoga-air'),
  bubble('Soft massage', '#AFC9A8', 'slow & round', 'soft-massage'),
  bubble('Light water', '#B9ADD9', 'quiet flow', 'light-water'),
  bubble('Warm earth', '#D8C29E', 'grounded', 'warm-earth'),
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

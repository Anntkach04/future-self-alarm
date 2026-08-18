export type Mood = {
  id: string;
  label: string;
  color: string;
};

/** Four quick check-ins on the dashboard — colours match the feeling. */
export const BASE_MOODS: Mood[] = [
  { id: 'heavy', label: 'heavy', color: '#A8B8D0' }, // cool slate — weighted, somber
  { id: 'restless', label: 'restless', color: '#E98D73' }, // warm coral — agitated
  { id: 'steady', label: 'steady', color: '#AFC9A8' }, // sage — grounded, even
  { id: 'light', label: 'light', color: '#FEC554' }, // warm sun — bright, airy
];

/** Extra states on the More screen. */
export const MORE_MOODS: Mood[] = [
  { id: 'tired', label: 'tired', color: '#C9B8A8' },
  { id: 'sad', label: 'sad', color: '#A8B8D0' },
  { id: 'anxious', label: 'anxious', color: '#B9ADD9' },
  { id: 'lonely', label: 'lonely', color: '#CDB5C4' },
  { id: 'overwhelmed', label: 'overwhelmed', color: '#EDB28C' },
  { id: 'angry', label: 'angry', color: '#E98D73' },
  { id: 'scattered', label: 'scattered', color: '#D8C29E' },
  { id: 'tender', label: 'tender', color: '#E8A8C0' },
  { id: 'hopeful', label: 'hopeful', color: '#C5E86A' },
  { id: 'grateful', label: 'grateful', color: '#ADDEFF' },
  { id: 'connected', label: 'connected', color: '#6B91FF' },
  { id: 'calm', label: 'calm', color: '#8FBDB7' },
  { id: 'numb', label: 'numb', color: '#B5C9BE' }, // flat, muted
  { id: 'inspired', label: 'inspired', color: '#FF9A3C' }, // warm spark
  { id: 'stuck', label: 'stuck', color: '#D4C4A8' }, // stagnant, heavy
  { id: 'playful', label: 'playful', color: '#FF7FB5' }, // light, fun
];

export function findMood(id: string): Mood | undefined {
  return [...BASE_MOODS, ...MORE_MOODS].find((item) => item.id === id);
}

export type Mood = {
  id: string;
  label: string;
  color: string;
};

/** Four quick check-ins on the dashboard — colours match the feeling. */
export const BASE_MOODS: Mood[] = [
  { id: 'heavy', label: 'heavy', color: '#A9C3D8' }, // cool slate — weighted, somber
  { id: 'restless', label: 'restless', color: '#DFA07C' }, // warm coral — agitated
  { id: 'steady', label: 'steady', color: '#A8C294' }, // sage — grounded, even
  { id: 'light', label: 'light', color: '#E8C276' }, // warm sun — bright, airy
];

/** Extra states on the More screen. */
export const MORE_MOODS: Mood[] = [
  { id: 'tired', label: 'tired', color: '#CBB792' },
  { id: 'sad', label: 'sad', color: '#A9C3D8' },
  { id: 'anxious', label: 'anxious', color: '#B8AFD3' },
  { id: 'lonely', label: 'lonely', color: '#D6AEB1' },
  { id: 'overwhelmed', label: 'overwhelmed', color: '#DFA07C' },
  { id: 'angry', label: 'angry', color: '#DFA07C' },
  { id: 'scattered', label: 'scattered', color: '#CBB792' },
  { id: 'tender', label: 'tender', color: '#D6AEB1' },
  { id: 'hopeful', label: 'hopeful', color: '#A8C294' },
  { id: 'grateful', label: 'grateful', color: '#A9C3D8' },
  { id: 'connected', label: 'connected', color: '#A9C3D8' },
  { id: 'calm', label: 'calm', color: '#9CC0B5' },
  { id: 'numb', label: 'numb', color: '#9CC0B5' }, // flat, muted
  { id: 'inspired', label: 'inspired', color: '#DFA07C' }, // warm spark
  { id: 'stuck', label: 'stuck', color: '#CBB792' }, // stagnant, heavy
  { id: 'playful', label: 'playful', color: '#D6AEB1' }, // light, fun
];

export function findMood(id: string): Mood | undefined {
  return [...BASE_MOODS, ...MORE_MOODS].find((item) => item.id === id);
}

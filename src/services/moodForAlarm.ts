import type { MoodCheckIn } from '../context/MoodCheckInContext';

export type AlarmMood = {
  label: string;
  note?: string;
  /** "finish the presentation": said out loud in the next morning's message. */
  intention?: string | null;
  /** How the last plan went: "wanted to go for a run; did it: yes". */
  followUp?: string | null;
  /** Their evening voice note: plays first, the AI answers it. */
  voiceNoteUri?: string | null;
  voiceNoteText?: string | null;
};

const OUTCOME_TEXT = {
  yes: 'yes, they did it',
  partly: 'partly',
  no: 'not yet',
} as const;

/**
 * What tomorrow's message should know from the check-ins: today's mood and
 * plan, plus whether yesterday's plan happened (answered on Home).
 */
export function moodForAlarm(
  today: MoodCheckIn | null,
  previous: MoodCheckIn | null
): AlarmMood | null {
  const followUp =
    previous?.intention && previous.outcome
      ? `they planned to ${previous.intention}; did it happen: ${OUTCOME_TEXT[previous.outcome]}`
      : null;
  if (!today && !followUp) return null;
  return {
    label: today?.moodLabel ?? '',
    note: today?.note ?? '',
    intention: today?.intention ?? null,
    followUp,
    voiceNoteUri: today?.voiceNoteUri ?? null,
    voiceNoteText: today?.voiceNoteText ?? null,
  };
}

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { refreshNudges } from '../services/nudges';

/** Silent host: keeps the evening nudges in line with alarms and today's check-in. */
export function NudgeHost() {
  const { alarms, ready } = useAlarms();
  const { today } = useMoodCheckIn();
  const { isPaused, eveningNudges } = useAppSettings();
  const { onboardingComplete, answers } = useOnboarding();

  const alarmsKey = alarms
    .map((a) => `${a.id}:${a.hour}:${a.minute}:${a.days.join('')}:${a.enabled}`)
    .join('|');

  useEffect(() => {
    if (!ready || !onboardingComplete) return;
    const run = () =>
      void refreshNudges({
        alarms,
        paused: isPaused,
        eveningNudges,
        wakeStruggle: answers.wakeStruggle,
        checkedInToday: Boolean(today),
      });
    run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => sub.remove();
    // alarmsKey covers alarm edits without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    onboardingComplete,
    alarmsKey,
    isPaused,
    eveningNudges,
    answers.wakeStruggle,
    Boolean(today),
  ]);

  return null;
}

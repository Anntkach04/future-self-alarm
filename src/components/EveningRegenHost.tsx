import { useEffect, useRef } from 'react';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { maybeEveningRegen } from '../services/eveningRegen';
import { resolveVoiceId } from '../services/defaultVoice';

let regenInFlight = false;

/** Silent host: refreshes the next wake when the mood changes, and daily. */
export function EveningRegenHost() {
  const { alarms, updateAlarm, ready } = useAlarms();
  const { answers, voice } = useOnboarding();
  const { today } = useMoodCheckIn();
  const { voiceLevel, bedLevel, isPaused } = useAppSettings();

  const alarmsRef = useRef(alarms);
  const answersRef = useRef(answers);
  const todayRef = useRef(today);
  const updateAlarmRef = useRef(updateAlarm);
  alarmsRef.current = alarms;
  answersRef.current = answers;
  todayRef.current = today;
  updateAlarmRef.current = updateAlarm;

  useEffect(() => {
    if (!ready) return;
    const voiceId = resolveVoiceId(voice.voiceId);
    if (!voiceId || voice.isDemo) return;
    const timer = setTimeout(() => {
      if (regenInFlight) return;
      regenInFlight = true;
      const mood = todayRef.current;
      void maybeEveningRegen({
        alarms: alarmsRef.current,
        voiceId,
        answers: answersRef.current,
        mood: mood ? { label: mood.moodLabel, note: mood.note } : null,
        voiceLevel,
        bedLevel,
        paused: isPaused,
        updateAlarm: updateAlarmRef.current,
      })
        .catch(() => {})
        .finally(() => {
          regenInFlight = false;
        });
    }, 2500);
    return () => clearTimeout(timer);
  }, [
    ready,
    voice.voiceId,
    voice.isDemo,
    voiceLevel,
    bedLevel,
    isPaused,
    today?.moodLabel,
    today?.note,
  ]);

  return null;
}

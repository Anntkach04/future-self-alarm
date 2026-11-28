import { useEffect, useRef } from 'react';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { resolveVoiceId } from '../services/defaultVoice';
import { repairMissingAlarmAudio } from '../services/repairMissingAlarmAudio';

let repairInFlight = false;

/**
 * Silent: after update / migration wiped local CAF+MP3, rebuild from voiceId
 * so users (and store updates) never need “open alarm → Done” again.
 */
export function AlarmAudioRepairHost() {
  const { alarms, updateAlarm, ready } = useAlarms();
  const { answers, voice, onboardingComplete } = useOnboarding();
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
    if (!ready || !onboardingComplete) return;
    const voiceId = resolveVoiceId(voice.voiceId);
    if (!voiceId || voice.isDemo) return;

    if (!alarmsRef.current.some((a) => a.enabled)) return;

    const timer = setTimeout(() => {
      if (repairInFlight) return;
      repairInFlight = true;
      const mood = todayRef.current;
      void repairMissingAlarmAudio({
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
          repairInFlight = false;
        });
    }, 1800);

    return () => clearTimeout(timer);
    // audioUri fingerprint — re-run after migrations null out files
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    onboardingComplete,
    voice.voiceId,
    voice.isDemo,
    voiceLevel,
    bedLevel,
    isPaused,
    alarms.map((a) => `${a.id}:${a.audioUri ? '1' : '0'}:${a.enabled}`).join('|'),
  ]);

  return null;
}

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { askAiConsentOnceForExistingUser } from '../services/aiConsent';
import { maybeEveningRegen } from '../services/eveningRegen';
import { moodForAlarm } from '../services/moodForAlarm';
import { resolveVoiceId } from '../services/defaultVoice';

let regenInFlight = false;

/** While the app is open, check every 15 min whether a ring entered its window. */
const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * Silent host: keeps the next week of rings stocked with their own messages
 * (see services/eveningRegen.ts). Checks on launch, on every return to the
 * foreground, when alarms or today's mood change, and periodically while open.
 */
export function EveningRegenHost() {
  const { alarms, updateAlarm, ready } = useAlarms();
  const { answers, voice } = useOnboarding();
  const { today, previous } = useMoodCheckIn();
  const { isPaused } = useAppSettings();

  const alarmsRef = useRef(alarms);
  const answersRef = useRef(answers);
  const todayRef = useRef(today);
  const previousRef = useRef(previous);
  const updateAlarmRef = useRef(updateAlarm);
  const pausedRef = useRef(isPaused);
  alarmsRef.current = alarms;
  answersRef.current = answers;
  todayRef.current = today;
  previousRef.current = previous;
  updateAlarmRef.current = updateAlarm;
  pausedRef.current = isPaused;

  useEffect(() => {
    if (!ready) return;
    const voiceId = resolveVoiceId(voice.voiceId);
    if (!voiceId || voice.isDemo) return;

    const run = () => {
      if (regenInFlight) return;
      regenInFlight = true;
      const mood = moodForAlarm(todayRef.current, previousRef.current);
      // Existing users never saw consent v2, so every message was the fixed
      // template. Ask once before building, so this ring is already personal.
      void askAiConsentOnceForExistingUser()
        .catch(() => false)
        .then(() =>
          maybeEveningRegen({
            alarms: alarmsRef.current,
            voiceId,
            answers: answersRef.current,
            mood,
            paused: pausedRef.current,
            updateAlarm: updateAlarmRef.current,
          })
        )
        .catch(() => {})
        .finally(() => {
          regenInFlight = false;
        });
    };

    // Small delay so a burst of mood edits settles into one check.
    const first = setTimeout(run, 2500);
    const interval = setInterval(run, CHECK_EVERY_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      sub.remove();
    };
  }, [
    ready,
    voice.voiceId,
    voice.isDemo,
    isPaused,
    today?.moodLabel,
    today?.note,
    today?.intention,
    previous?.outcome,
    // Created / edited / toggled alarms need their week stocked.
    alarms
      .map((a) => `${a.id}:${a.hour}:${a.minute}:${a.days.join('')}:${a.enabled}`)
      .join('|'),
  ]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { getSessionToken } from '../services/apiAuth';
import {
  buildCloudProfile,
  scheduleCloudProfilePush,
} from '../services/profileSync';

/**
 * Keeps cloud profile roughly in sync while the user is signed in.
 * Pull/restore happens on Sign in with Apple.
 */
export function ProfileSyncHost() {
  const { answers, voice, onboardingComplete, ready: onboardingReady } =
    useOnboarding();
  const { today, ready: moodReady } = useMoodCheckIn();
  const { voiceLevel, bedLevel, ready: settingsReady } = useAppSettings();
  const lastJson = useRef('');

  useEffect(() => {
    if (!onboardingReady || !moodReady || !settingsReady) return;

    let cancelled = false;
    void (async () => {
      const token = await getSessionToken();
      if (!token || cancelled) return;

      const profile = buildCloudProfile({
        answers,
        voice,
        onboardingComplete,
        mood: today,
        mix: { voiceLevel, bedLevel },
      });
      const json = JSON.stringify(profile);
      if (json === lastJson.current) return;
      lastJson.current = json;
      scheduleCloudProfilePush(profile);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    answers,
    voice.voiceId,
    voice.isDemo,
    onboardingComplete,
    today,
    voiceLevel,
    bedLevel,
    onboardingReady,
    moodReady,
    settingsReady,
  ]);

  return null;
}

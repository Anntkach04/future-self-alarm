import type { OnboardingAnswers, VoiceProfile } from '../context/OnboardingContext';
import type { MoodCheckIn } from '../context/MoodCheckInContext';
import { authHeaders, getSessionToken, type ApiUser } from './apiAuth';

export const CLOUD_PROFILE_VERSION = 1 as const;

export type CloudMood = {
  moodId: string;
  moodLabel: string;
  note: string;
  advice: string;
  date: string;
};

export type CloudProfile = {
  version: typeof CLOUD_PROFILE_VERSION;
  answers: OnboardingAnswers;
  onboardingComplete: boolean;
  /** Voice sample stays on device; only the ElevenLabs id syncs. */
  voiceId: string | null;
  isDemoVoice: boolean;
  mood: CloudMood | null;
  mix: { voiceLevel: number; bedLevel: number } | null;
};

export type CloudBundle = {
  user: ApiUser;
  profile: CloudProfile | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseCloudProfile(raw: unknown): CloudProfile | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== CLOUD_PROFILE_VERSION) return null;
  if (!isRecord(raw.answers)) return null;

  const answers = raw.answers as unknown as OnboardingAnswers;
  const mood = isRecord(raw.mood)
    ? ({
        moodId: String(raw.mood.moodId || ''),
        moodLabel: String(raw.mood.moodLabel || ''),
        note: String(raw.mood.note || ''),
        advice: String(raw.mood.advice || ''),
        date: String(raw.mood.date || ''),
      } satisfies CloudMood)
    : null;

  const mix = isRecord(raw.mix)
    ? {
        voiceLevel: Number(raw.mix.voiceLevel),
        bedLevel: Number(raw.mix.bedLevel),
      }
    : null;

  return {
    version: CLOUD_PROFILE_VERSION,
    answers,
    onboardingComplete: Boolean(raw.onboardingComplete),
    voiceId:
      typeof raw.voiceId === 'string'
        ? raw.voiceId
        : raw.voiceId === null
          ? null
          : null,
    isDemoVoice: Boolean(raw.isDemoVoice),
    mood: mood?.moodId && mood.date ? mood : null,
    mix:
      mix &&
      Number.isFinite(mix.voiceLevel) &&
      Number.isFinite(mix.bedLevel)
        ? mix
        : null,
  };
}

export function buildCloudProfile(input: {
  answers: OnboardingAnswers;
  voice: Pick<VoiceProfile, 'voiceId' | 'isDemo'>;
  onboardingComplete: boolean;
  mood: MoodCheckIn | null;
  mix?: { voiceLevel: number; bedLevel: number } | null;
}): CloudProfile {
  return {
    version: CLOUD_PROFILE_VERSION,
    answers: input.answers,
    onboardingComplete: input.onboardingComplete,
    voiceId: input.voice.voiceId,
    isDemoVoice: input.voice.isDemo,
    mood: input.mood
      ? {
          moodId: input.mood.moodId,
          moodLabel: input.mood.moodLabel,
          note: input.mood.note,
          advice: input.mood.advice,
          date: input.mood.date,
        }
      : null,
    mix: input.mix ?? null,
  };
}

/** Prefer cloud for returning accounts; push when cloud has nothing useful yet. */
export function shouldPreferCloud(
  local: { onboardingComplete: boolean; voiceId: string | null; hasName: boolean },
  cloud: CloudProfile | null,
  serverVoiceId: string | null
): boolean {
  if (!cloud && !serverVoiceId) return false;
  const cloudVoice = cloud?.voiceId || serverVoiceId;
  const cloudReady =
    Boolean(cloud?.onboardingComplete) || Boolean(cloudVoice);
  if (!cloudReady) return false;

  const localEmpty =
    !local.onboardingComplete && !local.voiceId && !local.hasName;
  if (localEmpty) return true;

  // Returning user (reinstall / new phone): restore finished cloud profile.
  if (cloud?.onboardingComplete && cloudVoice) return true;

  // Local onboarding started but no clone yet, cloud already has a voice.
  if (!local.voiceId && cloudVoice) return true;

  return false;
}

async function apiBase() {
  const { getApiUrl } = await import('./elevenlabs');
  return getApiUrl();
}

export async function fetchCloudBundle(): Promise<CloudBundle | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const response = await fetch(`${await apiBase()}/api/me`, {
    headers: await authHeaders(),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error('Could not load cloud profile');
  }
  const data = (await response.json()) as { user?: ApiUser };
  if (!data.user) return null;
  return {
    user: data.user,
    profile: parseCloudProfile(data.user.profile),
  };
}

export async function pushCloudProfile(profile: CloudProfile): Promise<ApiUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const response = await fetch(`${await apiBase()}/api/me`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      voiceId: profile.voiceId,
      profile,
    }),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text.slice(0, 160) || 'Could not save cloud profile');
  }
  const data = (await response.json()) as { user?: ApiUser };
  return data.user ?? null;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let latestPayload: CloudProfile | null = null;

/** Debounce rapid chip toggles; fire-and-forget. */
export function scheduleCloudProfilePush(profile: CloudProfile) {
  latestPayload = profile;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const next = latestPayload;
    pushTimer = null;
    if (!next) return;
    void pushCloudProfile(next).catch((error) => {
      console.warn('Cloud profile push failed', error);
    });
  }, 900);
}

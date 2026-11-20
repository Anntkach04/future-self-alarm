import { TEMP_ELEVENLABS_TTS_ONLY } from '../config/devBypass';
import { DEMO_VOICE } from './elevenlabs';

/** Premade ElevenLabs voice used while Instant Voice Cloning is unavailable. */
export function getDefaultPremadeVoiceId() {
  return DEMO_VOICE.id;
}

export function resolveVoiceId(stored: string | null) {
  if (stored) return stored;
  // Never silently swap in Rachel/DEMO for real alarms.
  if (TEMP_ELEVENLABS_TTS_ONLY) return getDefaultPremadeVoiceId();
  return null;
}

export function isPremadeDemoVoiceId(voiceId: string | null | undefined) {
  return Boolean(voiceId && voiceId === DEMO_VOICE.id);
}

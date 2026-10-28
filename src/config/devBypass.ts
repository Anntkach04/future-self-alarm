/**
 * Temporary founder-only bypasses. Turn off before App Store.
 *
 * To remove the voice-record skip button later, tell Cursor:
 * «Прибери dev skip на записі голосу (VOICE_ONBOARDING_SKIP_ENABLED)»
 *
 * To remove the onboarding reset button later, tell Cursor:
 * «Прибери dev reset онбордингу (ONBOARDING_RESET_ENABLED)»
 */
export const VOICE_ONBOARDING_SKIP_ENABLED = true;
export const ONBOARDING_RESET_ENABLED = true;

/**
 * When true, skip Instant Voice Cloning and speak with a premade voice.
 * Off so a recording is still what gets cloned.
 */
export const TEMP_ELEVENLABS_TTS_ONLY = false;

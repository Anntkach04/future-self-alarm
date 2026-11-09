/**
 * Lightweight on-device check — no server round-trip.
 * Uses duration + how loud/often the mic heard speech during karaoke.
 */

export type RecordingQualityIssue = 'too_short' | 'too_quiet' | 'too_much_silence';

export type RecordingQuality = {
  ok: boolean;
  issue?: RecordingQualityIssue;
  /** Shown only when !ok */
  message: string | null;
};

export type RecordingQualityStats = {
  durationSec: number;
  /** Peak Apple STT volume (~-2…2). Speech usually > ~0.35 */
  peakVolume: number;
  /** ms where we considered the user to be speaking */
  speechMs: number;
};

const MIN_OK_SECONDS = 45;
const MIN_PEAK = 0.28;
const MIN_SPEECH_RATIO = 0.22;

export function assessRecordingQuality(
  stats: RecordingQualityStats
): RecordingQuality {
  const { durationSec, peakVolume, speechMs } = stats;

  if (durationSec > 0 && durationSec < MIN_OK_SECONDS) {
    return {
      ok: false,
      issue: 'too_short',
      message:
        'This take is too short for a solid clone. Re-record in a quiet room. About two minutes of natural speech works best.',
    };
  }

  if (durationSec >= 8 && peakVolume < MIN_PEAK) {
    return {
      ok: false,
      issue: 'too_quiet',
      message:
        'Your voice came through too quietly. Hold the phone closer (~20 cm) and re-record a bit louder.',
    };
  }

  const speechRatio =
    durationSec > 0 ? speechMs / Math.max(durationSec * 1000, 1) : 0;
  if (durationSec >= MIN_OK_SECONDS && speechRatio < MIN_SPEECH_RATIO) {
    return {
      ok: false,
      issue: 'too_much_silence',
      message:
        'A lot of this take is silence. Re-record and keep reading the lines. Your future self needs clear speech to sound like you.',
    };
  }

  return { ok: true, message: null };
}

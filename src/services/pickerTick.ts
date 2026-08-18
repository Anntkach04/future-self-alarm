import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let lastTickAt = 0;
let audioCtx: AudioContext | null = null;

function playTickSound() {
  if (typeof window === 'undefined') return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  try {
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 1180;
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.018);
  } catch {
    /* ignore unsupported audio */
  }
}

/** One light detent per value crossed — not a continuous buzz. */
export function playPickerTick() {
  const now = Date.now();
  if (now - lastTickAt < 32) return;
  lastTickAt = now;

  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(
      Haptics.AndroidHaptics.Clock_Tick
    ).catch(() => {});
    return;
  }

  if (Platform.OS === 'ios') {
    void Haptics.selectionAsync().catch(() => {});
    return;
  }

  playTickSound();
  void Haptics.selectionAsync().catch(() => {});
}

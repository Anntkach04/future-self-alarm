import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Soft ack when a voice-script line advances. */
const LINE = require('../../assets/sounds/ui_line.wav');
/** Warm chord for Got it. / You’re all set / congrats. */
const SUCCESS = require('../../assets/sounds/ui_success.wav');

async function playAsset(
  asset: number,
  volume: number,
  opts?: { touchAudioMode?: boolean }
) {
  if (Platform.OS === 'web') return;
  try {
    // Never flip allowsRecording here — that kills mic/STT mid karaoke.
    if (opts?.touchAudioMode) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    }
    const player = createAudioPlayer(asset);
    player.volume = volume;
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* already gone */
      }
    }, 1200);
  } catch {
    /* sound optional */
  }
}

/** When a script line is accepted / advances (during recording — no audio-mode change). */
export async function playLineSuccessSound() {
  if (Platform.OS !== 'web') {
    void Haptics.selectionAsync().catch(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    });
  }
  await playAsset(LINE, 0.4);
}

/** Got it. / You’re all set / onboarding congrats (recording already stopped). */
export async function playAllSetSound() {
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          () => {}
        );
      }
    );
  }
  await playAsset(SUCCESS, 0.55, { touchAudioMode: true });
}

/** Alias — same soft success chord as Got it. */
export async function playCongratsSound() {
  await playAllSetSound();
}

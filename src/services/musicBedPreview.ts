import { Audio } from 'expo-av';
import { getApiUrl } from './elevenlabs';

const PREVIEW_MAX_MS = 30_000;

let sound: Audio.Sound | null = null;
let playingId: string | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function clearStopTimer() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

export async function stopMusicBedPreview() {
  clearStopTimer();
  if (!sound) {
    playingId = null;
    return;
  }
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    /* ignore */
  }
  sound = null;
  playingId = null;
}

export async function toggleMusicBedPreview(bedId: string) {
  if (playingId === bedId) {
    await stopMusicBedPreview();
    return;
  }
  await stopMusicBedPreview();
  const url = `${getApiUrl()}/api/beds/${encodeURIComponent(bedId)}/preview`;
  const { sound: next } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, isLooping: false, volume: 0.55 }
  );
  sound = next;
  playingId = bedId;

  stopTimer = setTimeout(() => {
    void stopMusicBedPreview();
  }, PREVIEW_MAX_MS);

  next.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void stopMusicBedPreview();
    }
  });
}

export function getPlayingBedId() {
  return playingId;
}

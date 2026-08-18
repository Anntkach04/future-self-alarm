import { Audio } from 'expo-av';
import { Platform } from 'react-native';
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

async function createSound(uri: string) {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
  return Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, isLooping: false, volume: 0.55 }
  );
}

export async function toggleMusicBedPreview(bedId: string) {
  if (playingId === bedId) {
    await stopMusicBedPreview();
    return;
  }
  await stopMusicBedPreview();
  const url = `${getApiUrl()}/api/beds/${encodeURIComponent(bedId)}/preview`;

  let next: Audio.Sound;
  try {
    const created = await createSound(url);
    next = created.sound;
  } catch (first) {
    if (Platform.OS === 'web') {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          'Music server is offline. Run bash scripts/start-server.sh'
        );
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const created = await createSound(objectUrl);
      next = created.sound;
    } else {
      throw first;
    }
  }

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

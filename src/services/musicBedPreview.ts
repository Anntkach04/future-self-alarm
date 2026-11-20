import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { getApiUrl } from './elevenlabs';

const PREVIEW_MAX_MS = 30_000;

let player: AudioPlayer | null = null;
let playingId: string | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let finishSub: { remove: () => void } | null = null;

function clearStopTimer() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

export async function stopMusicBedPreview() {
  clearStopTimer();
  finishSub?.remove();
  finishSub = null;
  if (!player) {
    playingId = null;
    return;
  }
  try {
    player.pause();
    player.remove();
  } catch {
    /* ignore */
  }
  player = null;
  playingId = null;
}

async function createPlayer(uri: string) {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });
  const next = createAudioPlayer({ uri });
  next.volume = 0.55;
  next.play();
  return next;
}

export async function toggleMusicBedPreview(bedId: string) {
  if (playingId === bedId) {
    await stopMusicBedPreview();
    return;
  }
  await stopMusicBedPreview();
  const url = `${getApiUrl()}/api/beds/${encodeURIComponent(bedId)}/preview`;

  let next: AudioPlayer;
  try {
    next = await createPlayer(url);
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
      next = await createPlayer(objectUrl);
    } else {
      throw first;
    }
  }

  player = next;
  playingId = bedId;

  stopTimer = setTimeout(() => {
    void stopMusicBedPreview();
  }, PREVIEW_MAX_MS);

  finishSub = next.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      void stopMusicBedPreview();
    }
  });
}

export function getPlayingBedId() {
  return playingId;
}

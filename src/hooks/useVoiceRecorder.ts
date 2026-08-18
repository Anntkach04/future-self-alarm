import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type RecorderStatus = 'idle' | 'recording' | 'stopped';

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function useVoiceRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [metering, setMetering] = useState(-40);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    setPermissionGranted(permission.granted);
    if (!permission.granted) {
      setError('Microphone permission is required to clone your voice.');
    }
    return permission.granted;
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const granted = permissionGranted || (await requestPermission());
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recording.setOnRecordingStatusUpdate((next) => {
        if (next.isRecording) {
          setDurationMs(next.durationMillis || 0);
          if (typeof next.metering === 'number') {
            setMetering(next.metering);
          }
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setUri(null);
      setDurationMs(0);
      setStatus('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording');
      setStatus('idle');
    }
  }, [permissionGranted, requestPermission]);

  const stop = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return null;

      await recording.stopAndUnloadAsync();
      const nextUri = recording.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setUri(nextUri);
      setStatus('stopped');
      return nextUri;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
      setStatus('idle');
      return null;
    }
  }, []);

  const reset = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
    }
    setUri(null);
    setDurationMs(0);
    setMetering(-40);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    uri,
    durationMs,
    durationLabel: formatMs(durationMs),
    durationSec: Math.floor(durationMs / 1000),
    metering,
    error,
    permissionGranted,
    requestPermission,
    start,
    stop,
    reset,
    platform: Platform.OS,
  };
}

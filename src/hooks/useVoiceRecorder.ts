import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
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
  const recordingRef = useRef<AudioRecorder | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [metering, setMetering] = useState(-40);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const clearMeterTimer = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearMeterTimer();
      void recordingRef.current?.stop().catch(() => undefined);
    };
  }, [clearMeterTimer]);

  const requestPermission = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
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

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      if (recordingRef.current) {
        await recordingRef.current.stop().catch(() => undefined);
        recordingRef.current = null;
      }

      const recording = new AudioModule.AudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await recording.prepareToRecordAsync();
      recording.record();
      recordingRef.current = recording;

      clearMeterTimer();
      meterTimerRef.current = setInterval(() => {
        const state = recording.getStatus();
        if (!state.isRecording) return;
        setDurationMs(state.durationMillis || 0);
        if (typeof state.metering === 'number') {
          setMetering(state.metering);
        }
      }, 120);

      setUri(null);
      setDurationMs(0);
      setStatus('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording');
      setStatus('idle');
    }
  }, [clearMeterTimer, permissionGranted, requestPermission]);

  const stop = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return null;

      clearMeterTimer();
      await recording.stop();
      const nextUri = recording.uri;
      recordingRef.current = null;

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      setUri(nextUri);
      setStatus('stopped');
      return nextUri;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
      setStatus('idle');
      return null;
    }
  }, [clearMeterTimer]);

  const reset = useCallback(async () => {
    clearMeterTimer();
    if (recordingRef.current) {
      await recordingRef.current.stop().catch(() => undefined);
      recordingRef.current = null;
    }
    setUri(null);
    setDurationMs(0);
    setMetering(-40);
    setStatus('idle');
    setError(null);
  }, [clearMeterTimer]);

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

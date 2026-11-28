import type { AudioPlayer, AudioSample } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { LiveWaveform } from './LiveWaveform';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { brightPalette, colors } from '../theme';

function rmsOf(sample: AudioSample) {
  const frames = sample.channels[0]?.frames;
  if (!frames?.length) return 0;
  let sum = 0;
  let n = 0;
  // Every 4th frame is plenty for a speaking / pause signal.
  for (let i = 0; i < frames.length; i += 4) {
    sum += frames[i] * frames[i];
    n += 1;
  }
  return Math.sqrt(sum / Math.max(1, n));
}

/** Above this RMS the voice is "speaking" (bars swing big), below it a pause. */
const SPEAKING_RMS = 0.02;

/**
 * The same colored bars as the karaoke recorder (LiveWaveform). While the
 * voice plays they swing big on words and settle on pauses, using expo-audio
 * sampling when supported; otherwise they just move while playing.
 */
export function VoiceLevelBars({
  player,
  playing,
}: {
  player: AudioPlayer | null;
  playing: boolean;
}) {
  const [hearing, setHearing] = useState(false);
  const hearingRef = useRef(false);

  useEffect(() => {
    if (!player || !playing || !player.isAudioSamplingSupported) {
      setHearing(playing);
      return;
    }
    try {
      player.setAudioSamplingEnabled(true);
    } catch {
      setHearing(playing);
      return;
    }
    const sub = player.addListener('audioSampleUpdate', (sample) => {
      const next = rmsOf(sample) > SPEAKING_RMS;
      // Only re-render when speaking starts or stops, not on every sample.
      if (next !== hearingRef.current) {
        hearingRef.current = next;
        setHearing(next);
      }
    });
    return () => {
      sub.remove();
      hearingRef.current = false;
      try {
        player.setAudioSamplingEnabled(false);
      } catch {
        // player may already be released
      }
    };
  }, [player, playing]);

  return <LiveWaveform active={playing} hearing={playing && hearing} />;
}

const IDLE = brightPalette[1];
const ACTIVE = brightPalette[8];

/** Big round play control, styled like the record button. */
export function PlayVoiceButton({
  playing,
  busy,
  onPress,
}: {
  playing: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      pulse.setValue(0);
      return;
    }
    const rings = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    rings.start();
    return () => rings.stop();
  }, [playing, pulse]);

  const ring = (delay: number) => ({
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35 - delay * 0.1, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.55 + delay * 0.2],
        }),
      },
    ],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Stop your voice' : 'Play your voice'}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      {playing ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: ACTIVE }, ring(0)]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: IDLE }, ring(0.35)]}
          />
        </>
      ) : null}
      <View
        style={[styles.button, { backgroundColor: playing ? ACTIVE : IDLE }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Svg width={30} height={30} viewBox="0 0 20 20">
            {playing ? (
              <>
                <Rect x={4} y={3} width={4} height={14} rx={1} fill={colors.text} />
                <Rect x={12} y={3} width={4} height={14} rx={1} fill={colors.text} />
              </>
            ) : (
              <Path
                d="M6 3.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L7.5 2.64A1 1 0 0 0 6 3.5Z"
                fill={colors.text}
              />
            )}
          </Svg>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 999,
  },
  button: {
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

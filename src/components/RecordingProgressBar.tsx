import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { accents, colors, fonts } from '../theme';
import {
  recordingProgress,
  recordingProgressLabel,
} from '../utils/recordingProgress';

type Props = {
  /** Elapsed recording time. Ignored unless `active` — stop/cancel resets the bar. */
  elapsedMs: number;
  targetSeconds: number;
  /** True while this take is open, including while it is paused. */
  active: boolean;
  paused?: boolean;
};

export function RecordingProgressBar({
  elapsedMs,
  targetSeconds,
  active,
  paused = false,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const shownMs = active ? elapsedMs : 0;
  const progress = recordingProgress(shownMs, targetSeconds);
  const done = active && progress.done;
  const label = recordingProgressLabel({
    remainingMs: progress.remainingMs,
    done,
    paused: active && paused && !done,
  });
  const fillWidth =
    trackWidth > 0 ? Math.round(trackWidth * progress.ratio) : 0;

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== trackWidth) setTrackWidth(next);
  };

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Voice recording progress"
      accessibilityValue={{
        min: 0,
        max: progress.targetSeconds,
        now: done ? progress.targetSeconds : progress.elapsedSeconds,
        text: label,
      }}
      style={styles.wrap}
    >
      <View style={styles.track} onLayout={onTrackLayout}>
        <View
          style={[
            styles.fill,
            done && styles.fillDone,
            { width: fillWidth },
          ]}
        />
      </View>
      <Text style={[styles.label, done && styles.labelDone]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.chip,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: accents.gold,
  },
  fillDone: {
    backgroundColor: accents.lime,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelDone: {
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
});

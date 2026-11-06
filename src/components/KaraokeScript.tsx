import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, fonts, noFakeLight } from '../theme';

export type KaraokeWord = {
  text: string;
  start: number;
  end: number;
};

type Props = {
  text: string;
  words?: KaraokeWord[] | null;
  /** Seconds into playback — words with start <= time stay highlighted. */
  currentTime: number;
  /** When not playing, no words highlighted (replay starts clean). */
  active: boolean;
  style?: TextStyle;
};

const SPOKEN = '#E23D28';

/**
 * Word-level karaoke highlight. Color only — no bold/size changes so wraps stay stable.
 */
export function KaraokeScript({
  text,
  words,
  currentTime,
  active,
  style,
}: Props) {
  if (!words?.length) {
    return <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={[styles.body, style]}>{text}</Text>;
  }

  return (
    <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={[styles.body, style]}>
      {words.map((w, i) => {
        const spoken = active && currentTime >= w.start - 0.02;
        return (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" key={`${i}-${w.start}`}>
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={{ color: spoken ? SPOKEN : colors.text }}>{w.text}</Text>
            {i < words.length - 1 ? ' ' : ''}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    textAlign: 'center',
    ...noFakeLight,
  },
});

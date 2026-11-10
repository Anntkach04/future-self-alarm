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

/** Long dashes read as robotic copy; the script uses commas and full stops. */
export function cleanScript(text: string) {
  return text
    .replace(/\s*[\u2014\u2013\u2015]\s*/g, '. ')
    .replace(/\.\s*\.\s/g, '. ')
    .replace(/\.\s+([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Word timings when the server sent none. Paced like speech (about 14
 * characters a second plus a breath at punctuation), NOT stretched over the
 * whole file: the audio ends with a music tail, so spreading words across
 * the full duration made the highlight lag far behind the voice.
 */
export function estimateSpeechWords(text: string, durationSec: number): KaraokeWord[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const weight = (w: string) =>
    w.length + 2 + (/[.!?]$/.test(w) ? 6 : /[,;:]$/.test(w) ? 3 : 0);
  const total = parts.reduce((sum, w) => sum + weight(w), 0);
  const spoken = text.replace(/\s+/g, ' ').length / 14 + parts.length * 0.04;
  const speech = Math.min(Math.max(durationSec, 1), Math.max(spoken, 1));
  let t = 0;
  return parts.map((w) => {
    const slot = (weight(w) / total) * speech;
    const word = { text: w, start: t, end: t + slot };
    t += slot;
    return word;
  });
}

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

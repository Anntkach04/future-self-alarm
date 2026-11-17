import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { displayWords, spokenDisplayCount } from '../services/speechMatch';
import { brightPalette, colors, fonts, noFakeBold } from '../theme';

type Props = {
  text: string;
  spokenCount: number;
};

const SPOKEN = brightPalette[6];

/** Instrument Serif at 30px: average glyph width incl. word gap, in px. */
const AVG_CHAR_PX = 13.2;

/**
 * Split words into rows of similar length so a line never ends with one or
 * two words hanging alone underneath.
 */
function balanceRows(words: string[], width: number): number[][] {
  const indexes = words.map((_, i) => i);
  if (!width || !words.length) return [indexes];
  const total = words.join(' ').length;
  const perRow = Math.max(8, Math.floor(width / AVG_CHAR_PX));
  const rows = Math.ceil(total / perRow);
  if (rows <= 1) return [indexes];
  const target = total / rows;
  const out: number[][] = [];
  let row: number[] = [];
  let len = 0;
  words.forEach((w, i) => {
    const add = (row.length ? 1 : 0) + w.length;
    const remainingRows = rows - out.length;
    // Break when this word overshoots the target more than stopping short does.
    if (row.length && remainingRows > 1 && len + add - target > target - len) {
      out.push(row);
      row = [];
      len = 0;
    }
    row.push(i);
    len += (row.length > 1 ? 1 : 0) + w.length;
  });
  if (row.length) out.push(row);
  return out;
}

export function KaraokeLine({ text, spokenCount }: Props) {
  const words = useMemo(() => displayWords(text), [text]);
  const [width, setWidth] = useState(0);
  const rows = useMemo(() => balanceRows(words, width - 8), [words, width]);
  const highlighted = useMemo(
    () => spokenDisplayCount(text, spokenCount),
    [spokenCount, text]
  );

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {rows.map((row, r) => (
        <View key={`${text}-row-${r}`} style={styles.row}>
          {row.map((i) => (
            <Text maxFontSizeMultiplier={1.2}
              key={`${text}-${i}`}
              style={[styles.word, i < highlighted ? styles.spoken : styles.unspoken]}
            >
              {words[i]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
    rowGap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
  },
  word: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0.15,
    ...noFakeBold,
  },
  spoken: {
    color: SPOKEN,
    ...noFakeBold,
  },
  unspoken: {
    color: colors.text,
    ...noFakeBold,
  },
});

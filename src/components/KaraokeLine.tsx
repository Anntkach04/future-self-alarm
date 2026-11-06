import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { displayWords, spokenDisplayCount } from '../services/speechMatch';
import { brightPalette, colors, fonts, noFakeBold } from '../theme';

type Props = {
  text: string;
  spokenCount: number;
};

const SPOKEN = brightPalette[6];

/**
 * Comfortable size: script chunks are written to wrap into ~1–2 lines here.
 */
export function KaraokeLine({ text, spokenCount }: Props) {
  const words = useMemo(() => displayWords(text), [text]);
  const highlighted = useMemo(
    () => spokenDisplayCount(text, spokenCount),
    [spokenCount, text]
  );

  return (
    <View style={styles.wrap}>
      {words.map((word, i) => (
        <Text maxFontSizeMultiplier={1.2}
          key={`${text}-${i}`}
          style={[styles.word, i < highlighted ? styles.spoken : styles.unspoken]}
        >
          {word}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    rowGap: 6,
    columnGap: 8,
  },
  word: {
    fontFamily: fonts.headingRegular,
    fontSize: 30,
    lineHeight: 38,
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

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { displayWords, spokenDisplayCount } from '../services/speechMatch';
import { brightPalette, colors, fonts, noFakeBold } from '../theme';

type Props = {
  text: string;
  spokenCount: number;
};

const SPOKEN = brightPalette[6];

/** Word chips in a wrapping row — avoids nested-Text edge clipping. */
export function KaraokeLine({ text, spokenCount }: Props) {
  const words = useMemo(() => displayWords(text), [text]);
  const highlighted = useMemo(
    () => spokenDisplayCount(text, spokenCount),
    [spokenCount, text]
  );

  return (
    <View style={styles.wrap}>
      {words.map((word, i) => (
        <Text
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
    rowGap: 4,
    columnGap: 6,
  },
  word: {
    fontFamily: fonts.headingRegular,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 0.2,
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

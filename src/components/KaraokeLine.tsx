import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brightPalette, colors, fonts, noFakeBold } from '../theme';

type Props = {
  text: string;
  spokenCount: number;
};

const SPOKEN = brightPalette[6];

export function KaraokeLine({ text, spokenCount }: Props) {
  const words = useMemo(
    () => text.split(/\s+/).filter((word) => !/^[—–-]+$/.test(word)),
    [text]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        {words.map((word, i) => (
          <Text
            key={`${text}-${i}`}
            style={i < spokenCount ? styles.spoken : styles.unspoken}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: fonts.headingRegular,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 0.2,
    textAlign: 'center',
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
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});

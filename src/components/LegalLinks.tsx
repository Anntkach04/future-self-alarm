import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { privacyPolicyUrl, termsOfUseUrl } from '../config/legal';
import { colors, fonts } from '../theme';

type Props = {
  style?: object;
};

export function LegalLinks({ style }: Props) {
  const privacy = privacyPolicyUrl();
  const terms = termsOfUseUrl();
  if (!privacy && !terms) return null;

  return (
    <View style={[styles.row, style]}>
      {privacy ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(privacy)}
        >
          <Text maxFontSizeMultiplier={1.5} style={styles.link}>Privacy Policy</Text>
        </Pressable>
      ) : null}
      {privacy && terms ? <Text maxFontSizeMultiplier={1.5} style={styles.dot}>·</Text> : null}
      {terms ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(terms)}
        >
          <Text maxFontSizeMultiplier={1.5} style={styles.link}>Terms of Use</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  dot: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
  },
});

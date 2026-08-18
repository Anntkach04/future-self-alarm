import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

type Variant = 'hero' | 'title' | 'body' | 'bodyStrong' | 'muted' | 'label';

type Props = TextProps & {
  variant?: Variant;
};

const variantStyle = StyleSheet.create({
  hero: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bodyStrong: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '300',
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  label: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
});

export function AppText({ variant = 'body', style, ...rest }: Props) {
  return <RNText {...rest} style={[variantStyle[variant], style]} />;
}

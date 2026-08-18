import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, noFakeBold } from '../theme';
import { LogoSpinner } from './LogoSpinner';

type Props = {
  /** Defaults to cream `#FFFAEE`. Pass splash blue when needed. */
  backgroundColor?: string;
  message?: string;
  children?: ReactNode;
  style?: ViewStyle;
};

/** Full-screen waiting state: brand bg + spinning 48px logo. */
export function WaitingView({
  backgroundColor = colors.bg,
  message,
  children,
  style,
}: Props) {
  return (
    <View style={[styles.root, { backgroundColor }, style]}>
      <LogoSpinner />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  message: {
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    lineHeight: 26,
    color: '#1A1A1A',
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 40,
    ...noFakeBold,
  },
});

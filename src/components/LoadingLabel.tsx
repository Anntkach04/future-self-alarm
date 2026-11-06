import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

const STEP_MS = 420;

type DotsProps = {
  style?: StyleProp<TextStyle>;
};

/** Cycles `.` → `..` → `...` → `.` … */
export function LoadingDots({ style }: DotsProps) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((n) => (n % 3) + 1);
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  // Fixed width so the line doesn’t jump as dots grow.
  return (
    <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={[styles.dots, style]} accessible={false}>
      {'.'.repeat(step)}
      {'\u00A0'.repeat(3 - step)}
    </Text>
  );
}

type LabelProps = {
  /** Base copy without trailing dots / ellipsis. */
  text: string;
  style?: StyleProp<TextStyle>;
  dotsStyle?: StyleProp<TextStyle>;
};

/**
 * Loading line with animated ellipsis:
 * "Cloning your voice" + . → .. → ...
 */
export function LoadingLabel({ text, style, dotsStyle }: LabelProps) {
  const base = text.replace(/[\s.…]+$/u, '').trimEnd();
  return (
    <View style={styles.row} accessibilityRole="text">
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={style}>
        {base}
        <LoadingDots style={dotsStyle ?? style} />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  dots: {
    fontVariant: ['tabular-nums'],
  },
});

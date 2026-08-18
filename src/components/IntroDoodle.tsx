import { Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { IntroCardTone } from './StackedIntroCards';

const DOODLES: Record<IntroCardTone, ImageSourcePropType> = {
  sky: require('../../assets/illustrations/vector-1.png'),
  coral: require('../../assets/illustrations/vector-2.png'),
  gold: require('../../assets/illustrations/vector-3.png'),
};

const SIZES: Record<IntroCardTone, { width: number; height: number }> = {
  sky: { width: 187, height: 157 },
  coral: { width: 153, height: 112 },
  gold: { width: 237, height: 105 },
};

type Props = {
  tone: IntroCardTone;
};

/** Hand-drawn doodles from Figma (black ink on transparent). */
export function IntroDoodle({ tone }: Props) {
  const size = SIZES[tone];
  return (
    <Image
      source={DOODLES[tone]}
      style={[styles.img, size]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  img: {
    opacity: 0.9,
  },
});

import { Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { IntroCardTone } from './StackedIntroCards';

const DOODLES: Record<IntroCardTone, ImageSourcePropType> = {
  sky: require('../../assets/illustrations/vector-1.png'),
  coral: require('../../assets/illustrations/vector-2.png'),
  gold: require('../../assets/illustrations/vector-3.png'),
};

/**
 * Box = the drawing's own aspect ratio wherever it should sit flush in the
 * card's corner. A wider box made "contain" center the art and left a big
 * empty strip on the right (sun rays: 237 wide for a 145 wide drawing).
 */
const SIZES: Record<IntroCardTone, { width: number; height: number }> = {
  sky: { width: 187, height: 157 },
  coral: { width: 153, height: 112 },
  // vector-3 is 885×643: 145×105 keeps it flush right and bottom, so the
  // right gap equals the bottom gap (the card's 24 px padding).
  gold: { width: 145, height: 105 },
};

/** Per-drawing nudge inside the corner (wave sits a little left of the edge). */
const OFFSETS: Partial<Record<IntroCardTone, { marginRight: number }>> = {
  sky: { marginRight: 16 },
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
      style={[styles.img, size, OFFSETS[tone]]}
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

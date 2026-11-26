import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Thin ×, same stroke as the back arrow. */
export function CloseIcon({
  size = 28,
  color = colors.text,
  strokeWidth = 1.75,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

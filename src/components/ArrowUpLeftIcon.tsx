import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Thin ← — shaft + V head, pointing straight left. */
export function ArrowUpLeftIcon({
  size = 28,
  color = colors.text,
  strokeWidth = 1.75,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 5L5 12L12 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

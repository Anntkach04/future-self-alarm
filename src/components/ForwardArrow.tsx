import { Platform, View } from 'react-native';
import { ArrowUpRightIcon } from './ArrowUpRightIcon';
import { colors } from '../theme';

type Props = {
  size?: number;
  color?: string;
  /** true = ↗ at 0°. false = rotated 45° so it reads as → */
  lifted?: boolean;
};

export function ForwardArrow({
  size = 22,
  color = colors.arrow,
  lifted = false,
}: Props) {
  return (
    <View
      style={[
        { transform: [{ rotate: lifted ? '0deg' : '45deg' }] },
        Platform.OS === 'web'
          ? ({ transition: 'transform 180ms ease' } as object)
          : null,
      ]}
    >
      <ArrowUpRightIcon size={size} color={color} strokeWidth={1.75} />
    </View>
  );
}

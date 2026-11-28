import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { IntroCardTone } from './StackedIntroCards';

/** Same line style as the Music & sounds tiles: thin ink strokes. */
const INK = 'rgba(26, 26, 26, 0.6)';
const stroke = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

const W = 150;
const H = 110;

/** "An alarm that sounds like you": an alarm clock speaking in soft waves. */
function VoiceClock() {
  return (
    <Svg width={W} height={H} viewBox="0 0 150 110">
      <Circle cx={52} cy={60} r={30} {...stroke} />
      <Path d="M52 44 V60 L63 67" {...stroke} />
      <Path d="M28 30 L36 38 M76 30 L68 38" {...stroke} />
      <Path d="M36 92 L32 100 M68 92 L72 100" {...stroke} />
      <Path d="M98 48 q8 12 0 24" {...stroke} />
      <Path d="M110 40 q14 20 0 40" {...stroke} />
      <Path d="M122 32 q20 28 0 56" {...stroke} />
    </Svg>
  );
}

/** "A new message every morning": a note arriving with a little sun. */
function MorningNote() {
  return (
    <Svg width={W} height={H} viewBox="0 0 150 110">
      <Rect x={20} y={40} width={84} height={58} rx={10} {...stroke} />
      <Path d="M34 58 H90 M34 70 H82 M34 82 H70" {...stroke} />
      <Circle cx={118} cy={30} r={11} {...stroke} />
      <Path
        d="M118 8 V13 M118 47 V52 M96 30 H101 M135 30 H140 M102 14 L105 17 M131 43 L134 46 M134 14 L131 17"
        {...stroke}
      />
    </Svg>
  );
}

/** "Start your day with a reason": a path rising to the sun. */
function RisingPath() {
  return (
    <Svg width={W} height={H} viewBox="0 0 150 110">
      <Path d="M70 70 A30 30 0 0 1 130 70" {...stroke} />
      <Path d="M100 28 V34 M74 40 L78 44 M126 40 L122 44" {...stroke} />
      <Path d="M8 70 H142" {...stroke} />
      <Path d="M22 102 C40 96 46 86 64 84 S92 78 100 72" {...stroke} />
      <Path d="M90 70 L100 72 L94 80" {...stroke} />
    </Svg>
  );
}

const ART: Record<IntroCardTone, () => ReactElement> = {
  sky: VoiceClock,
  coral: MorningNote,
  gold: RisingPath,
};

type Props = {
  tone: IntroCardTone;
};

/** One drawing per intro card, sitting in its bottom-right corner. */
export function IntroDoodle({ tone }: Props) {
  const Art = ART[tone];
  return <Art />;
}

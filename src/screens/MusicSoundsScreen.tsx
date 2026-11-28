import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { useOnboarding } from '../context/OnboardingContext';
import { useLayout } from '../layout/LayoutContext';
import { RootStackParamList } from '../navigation/types';
import { checkVoiceApiHealth } from '../services/elevenlabs';
import {
  getPlayingBedId,
  stopMusicBedPreview,
  toggleMusicBedPreview,
} from '../services/musicBedPreview';
import { userFacingError } from '../services/userFacingError';
import {
  accents,
  colors,
  fonts,
  earth,
  noFakeBold,
  opticalLeft,
  radii,
  spacing,
  typeScale,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicSounds'>;

type Kind = 'beds' | 'sounds';
type Motif =
  | 'calm' | 'morning' | 'sunrise' | 'ocean' | 'lofi' | 'lotus' | 'hills'
  | 'birds' | 'waves' | 'rain' | 'bowl' | 'stream' | 'chimes' | 'leaves' | 'none';
type Option = { id: string; label: string };

/** Each tile: one hue from the earth palette (theme.ts) and a simple drawing. */
const LOOK: Record<string, { color: string; motif: Motif }> = {
  'soft-calm': { color: earth.lilac, motif: 'calm' },
  'bali-morning': { color: earth.orange, motif: 'sunrise' },
  'yoga-air': { color: earth.blue, motif: 'lotus' },
  'warm-earth': { color: earth.tan, motif: 'hills' },
  'music-soft-morning': { color: earth.gold, motif: 'morning' },
  'music-sunrise': { color: earth.orange, motif: 'sunrise' },
  'music-ocean-calm': { color: earth.teal, motif: 'ocean' },
  'music-lofi-morning': { color: earth.rose, motif: 'lofi' },
  'sound-birds': { color: earth.green, motif: 'birds' },
  'sound-waves': { color: earth.teal, motif: 'waves' },
  'sound-rain': { color: earth.lilac, motif: 'rain' },
  'sound-bowl': { color: earth.rose, motif: 'bowl' },
  'sound-stream': { color: earth.blue, motif: 'stream' },
  'sound-chimes': { color: earth.gold, motif: 'chimes' },
  'sound-forest': { color: earth.orange, motif: 'leaves' },
  none: { color: colors.chip, motif: 'none' },
};

const NONE: Option = { id: 'none', label: 'None' };
/** Shown before the server answers (and if it can't be reached). */
const FALLBACK_MUSIC: Option[] = [{ id: 'soft-calm', label: 'Soft calm' }];
const FALLBACK_SOUNDS: Option[] = [
  { id: 'sound-birds', label: 'Birds' },
  { id: 'sound-waves', label: 'Waves' },
  { id: 'sound-rain', label: 'Rain' },
  { id: 'sound-bowl', label: 'Singing bowl' },
  { id: 'sound-stream', label: 'Forest stream' },
  { id: 'sound-chimes', label: 'Wind chimes' },
  { id: 'sound-forest', label: 'Jungle sunrise' },
];

const INK = 'rgba(26, 26, 26, 0.55)';

function MotifArt({ motif, size }: { motif: Motif; size: number }) {
  const s = size;
  const stroke = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, fill: 'none' };
  switch (motif) {
    case 'calm':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          {[18, 30, 42].map((r) => (
            <Circle key={r} cx={50} cy={50} r={r} {...stroke} />
          ))}
        </Svg>
      );
    case 'morning':
    case 'sunrise':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M20 64 A30 30 0 0 1 80 64" {...stroke} />
          <Path d="M12 64 H88" {...stroke} />
          {[[50, 22, 50, 30], [24, 34, 30, 40], [76, 34, 70, 40]].map(([x1, y1, x2, y2]) => (
            <Path key={`${x1}${y1}`} d={`M${x1} ${y1} L${x2} ${y2}`} {...stroke} />
          ))}
        </Svg>
      );
    case 'ocean':
    case 'waves':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          {[36, 52, 68].map((y) => (
            <Path key={y} d={`M10 ${y} q10 -10 20 0 t20 0 t20 0 t20 0`} {...stroke} />
          ))}
        </Svg>
      );
    case 'lofi':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          {[30, 42, 54, 66].map((x, i) => (
            <Rect key={x} x={x - 3} y={60 - (i % 2 ? 28 : 18)} width={6} height={i % 2 ? 28 : 18} rx={3} fill={INK} />
          ))}
        </Svg>
      );
    case 'birds':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M24 46 q8 -10 16 0 q8 -10 16 0" {...stroke} />
          <Path d="M50 64 q6 -8 12 0 q6 -8 12 0" {...stroke} />
        </Svg>
      );
    case 'lotus':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M50 70 C40 58 40 42 50 28 C60 42 60 58 50 70 Z" {...stroke} />
          <Path d="M50 70 C36 66 26 56 24 44 C36 46 46 56 50 70 Z" {...stroke} />
          <Path d="M50 70 C64 66 74 56 76 44 C64 46 54 56 50 70 Z" {...stroke} />
          <Path d="M28 78 H72" {...stroke} />
        </Svg>
      );
    case 'hills':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Circle cx={66} cy={34} r={8} {...stroke} />
          <Path d="M12 70 Q32 44 52 62 T88 58" {...stroke} />
          <Path d="M12 80 H88" {...stroke} />
        </Svg>
      );
    case 'bowl':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M26 54 H74 C72 68 62 76 50 76 C38 76 28 68 26 54 Z" {...stroke} />
          <Path d="M38 40 q12 -8 24 0" {...stroke} />
          <Path d="M32 30 q18 -12 36 0" {...stroke} />
        </Svg>
      );
    case 'stream':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M30 18 C50 34 30 50 50 64 S56 80 64 86" {...stroke} />
          <Path d="M46 18 C66 34 46 50 66 64 S72 80 80 86" {...stroke} />
          <Circle cx={30} cy={70} r={4} {...stroke} />
          <Circle cx={76} cy={36} r={3} {...stroke} />
        </Svg>
      );
    case 'chimes':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M24 22 H76" {...stroke} />
          {[[32, 52], [44, 64], [56, 58], [68, 46]].map(([x, y]) => (
            <G key={x}>
              <Path d={`M${x} 22 V${y - 18}`} {...stroke} strokeWidth={1.5} />
              <Path d={`M${x} ${y - 16} V${y}`} {...stroke} strokeWidth={4} />
            </G>
          ))}
        </Svg>
      );
    case 'leaves':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path d="M50 82 V40" {...stroke} />
          <Path d="M50 56 C36 56 26 46 24 32 C38 32 48 42 50 56 Z" {...stroke} />
          <Path d="M50 46 C64 46 74 36 76 22 C62 22 52 32 50 46 Z" {...stroke} />
        </Svg>
      );
    case 'rain':
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          {[[30, 26], [52, 20], [74, 30], [40, 52], [62, 48], [30, 72], [56, 74]].map(([x, y]) => (
            <Path key={`${x}${y}`} d={`M${x} ${y} l-4 10`} {...stroke} />
          ))}
        </Svg>
      );
    default:
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={22} {...stroke} strokeDasharray="4 6" />
        </Svg>
      );
  }
}

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 20 20">
      {playing ? (
        <>
          <Rect x={4} y={3} width={4} height={14} rx={1} fill={colors.text} />
          <Rect x={12} y={3} width={4} height={14} rx={1} fill={colors.text} />
        </>
      ) : (
        <Path
          d="M6 3.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L7.5 2.64A1 1 0 0 0 6 3.5Z"
          fill={colors.text}
        />
      )}
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 20 20">
      <Path d="M4 10.5 L8.5 15 L16 5.5" stroke={colors.bg} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Pick the music and the nature sound under your voice; ▶ to hear one. */
export function MusicSoundsScreen({}: Props) {
  const { answers, setMusicBedId, setWakeSoundId } = useOnboarding();
  const layout = useLayout();
  const { width } = useWindowDimensions();
  const [music, setMusic] = useState<Option[]>(FALLBACK_MUSIC);
  const [sounds, setSounds] = useState<Option[]>(FALLBACK_SOUNDS);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contentWidth = Math.min(width, layout.contentMaxWidth ?? width) - layout.horizontalPadding * 2;
  const tile = Math.floor((contentWidth - spacing.sm) / 2);

  useEffect(() => {
    let alive = true;
    checkVoiceApiHealth()
      .then((health) => {
        if (!alive) return;
        const beds = (health.beds ?? []).filter((b) => b.available);
        const nature = (health.sounds ?? []).filter((s) => s.available);
        if (beds.length) setMusic(beds.map(({ id, label }) => ({ id, label })));
        if (nature.length) setSounds(nature.map(({ id, label }) => ({ id, label })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      void stopMusicBedPreview();
    };
  }, []);

  const selectedMusic = answers.musicBedId || 'soft-calm';
  const selectedSound = answers.wakeSoundId || 'sound-birds';

  const preview = async (id: string, kind: Kind) => {
    setError(null);
    try {
      await toggleMusicBedPreview(id, kind);
      setPlaying(getPlayingBedId() ? `${kind}:${id}` : null);
    } catch (e) {
      setPlaying(null);
      setError(userFacingError(e, 'Could not play this sound.'));
    }
  };

  const section = (
    title: string,
    options: Option[],
    selected: string,
    onSelect: (id: string) => void,
    kind: Kind
  ) => (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.grid}>
        {[...options, NONE].map((opt) => {
          const look = LOOK[opt.id] ?? LOOK['soft-calm'];
          const isSelected = selected === opt.id;
          const key = `${kind}:${opt.id}`;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={opt.label}
              onPress={() => onSelect(opt.id)}
              style={({ pressed }) => [
                styles.tile,
                { width: tile, height: tile, backgroundColor: look.color },
                isSelected && styles.tileSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.art}>
                <MotifArt motif={look.motif} size={tile * 0.5} />
              </View>
              {isSelected ? (
                <View style={styles.check}>
                  <CheckIcon />
                </View>
              ) : null}
              {opt.id !== 'none' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={playing === key ? `Stop ${opt.label}` : `Play ${opt.label}`}
                  hitSlop={8}
                  onPress={() => void preview(opt.id, kind)}
                  style={styles.play}
                >
                  <PlayIcon playing={playing === key} />
                </Pressable>
              ) : null}
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.tileLabel}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <BackButton />
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>
          Music & sounds
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.caption}>
          Plays softly under your voice. New messages use your pick.
        </Text>
        {section('Music', music, selectedMusic, setMusicBedId, 'beds')}
        {section('Sound', sounds, selectedSound, setWakeSoundId, 'sounds')}
        {error ? (
          <Text maxFontSizeMultiplier={1.3} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginBottom: spacing.xs,
    ...noFakeBold,
  },
  caption: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: {
    borderColor: colors.text,
  },
  pressed: { opacity: 0.85 },
  art: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  check: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
    marginTop: spacing.sm,
  },
});

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { useOnboarding } from '../context/OnboardingContext';
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
  noFakeBold,
  opticalLeft,
  radii,
  spacing,
  typeScale,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicSounds'>;

type Option = { id: string; label: string };

const NONE: Option = { id: 'none', label: 'None' };
/** Shown before the server answers (and if it can't be reached). */
const FALLBACK_MUSIC: Option[] = [{ id: 'soft-calm', label: 'Soft calm' }];
const FALLBACK_SOUNDS: Option[] = [
  { id: 'sound-birds', label: 'Birds' },
  { id: 'sound-waves', label: 'Waves' },
  { id: 'sound-rain', label: 'Rain' },
];

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 20 20">
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

/** Pick the music and the nature sound under your voice; tap ▶ to hear one. */
export function MusicSoundsScreen({}: Props) {
  const { answers, setMusicBedId, setWakeSoundId } = useOnboarding();
  const [music, setMusic] = useState<Option[]>(FALLBACK_MUSIC);
  const [sounds, setSounds] = useState<Option[]>(FALLBACK_SOUNDS);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const preview = async (id: string, kind: 'beds' | 'sounds') => {
    setError(null);
    const key = `${kind}:${id}`;
    try {
      await toggleMusicBedPreview(id, kind);
      setPlaying(getPlayingBedId() ? key : null);
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
    kind: 'beds' | 'sounds'
  ) => (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
        {title}
      </Text>
      {[...options, NONE].map((opt) => {
        const isSelected = selected === opt.id;
        const key = `${kind}:${opt.id}`;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(opt.id)}
            style={({ pressed }) => [
              styles.row,
              isSelected && styles.rowSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[styles.rowText, isSelected && styles.rowTextSelected]}
            >
              {opt.label}
            </Text>
            {opt.id !== 'none' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  playing === key ? `Stop ${opt.label}` : `Play ${opt.label}`
                }
                hitSlop={8}
                onPress={() => void preview(opt.id, kind)}
                style={styles.play}
              >
                <PlayIcon playing={playing === key} />
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <BackButton style={styles.back} />
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>
          Music & sounds
        </Text>
        <Text maxFontSizeMultiplier={1.4} style={styles.caption}>
          Plays softly under your voice. New messages use your pick.
        </Text>
        {section('Music', music, selectedMusic, setMusicBedId, 'beds')}
        {section('Sound', sounds, selectedSound, setWakeSoundId, 'sounds')}
        {error ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    ...noFakeBold,
  },
  caption: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    marginBottom: spacing.xxs,
    ...noFakeBold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /** Light accent fill like the app's buttons, never solid black. */
  rowSelected: {
    backgroundColor: colors.fab,
    borderColor: colors.fab,
  },
  pressed: { opacity: 0.8 },
  rowText: {
    fontFamily: fonts.body,
    ...typeScale.body,
    color: colors.text,
  },
  rowTextSelected: {
    fontFamily: fonts.bodyMedium,
    ...noFakeBold,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accents.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
    marginTop: spacing.sm,
  },
});

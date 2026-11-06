import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceSettings'>;

const STEPS = [0.2, 0.35, 0.5, 0.65, 0.8, 1];

function LevelRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.sliderBlock}>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.sliderLabel}>
        {label} · {Math.round(value * 100)}%
      </Text>
      <View style={styles.stepRow}>
        {STEPS.map((step) => {
          const selected = Math.abs(value - step) < 0.01;
          return (
            <Pressable
              key={step}
              onPress={() => onChange(step)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={[styles.chipText, selected && styles.chipTextOn]}>
                {Math.round(step * 100)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function VoiceSettingsScreen({ navigation }: Props) {
  const { voiceLevel, bedLevel, setMixLevels } = useAppSettings();
  const [voice, setVoice] = useState(voiceLevel);
  const [bed, setBed] = useState(bedLevel);

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>voice</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        Re-record anytime. Mix changes apply to your next alarm.
      </Text>

      <LevelRow
        label="Your voice"
        value={voice}
        onChange={(v) => {
          setVoice(v);
          setMixLevels(v, bed);
        }}
      />
      <LevelRow
        label="Music bed"
        value={bed}
        onChange={(v) => {
          setBed(v);
          setMixLevels(voice, v);
        }}
      />

      <View style={styles.actions}>
        <TextArrowButton
          label="re-record voice"
          color={accents.coral}
          onPress={() => navigation.navigate('VoiceRecord')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  sliderBlock: {
    marginBottom: spacing.lg,
    gap: 10,
  },
  sliderLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: colors.text,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  chipTextOn: {
    color: colors.bg,
  },
  actions: {
    marginTop: 'auto',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
  },
});

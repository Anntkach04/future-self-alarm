import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { RecapPills } from '../components/RecapPills';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import {
  ALREADY_YOU_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, noFakeBold } from '../theme';
import { colorsForRecapSections } from '../utils/optionColors';
import { uiLabel } from '../utils/labels';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

type SectionProps = {
  title: string;
  items: string[];
  itemColors?: string[];
  onPress: () => void;
};

function Section({ title, items, itemColors, onPress }: SectionProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={styles.recapTitle}>{uiLabel(title)}</Text>
      <RecapPills items={items} colors={itemColors} />
    </Pressable>
  );
}

export function EditProfileScreen({ navigation }: Props) {
  const { answers } = useOnboarding();

  const openField = (field: ProfileFieldKey) =>
    navigation.navigate('ProfileFieldEdit', { field });

  const [
    goalsColors,
    proudColors,
    hardMorningColors,
    voiceColors,
  ] = useMemo(
    () =>
      colorsForRecapSections([
        { items: answers.futureSelf, options: FUTURE_SELF_OPTIONS },
        { items: answers.alreadyProud, options: ALREADY_YOU_OPTIONS },
        { items: answers.hardMornings, options: HARD_MORNING_OPTIONS },
        {
          items: answers.voiceStyle ? [answers.voiceStyle] : [],
          options: VOICE_STYLE_OPTIONS,
        },
      ]),
    [
      answers.futureSelf,
      answers.alreadyProud,
      answers.hardMornings,
      answers.voiceStyle,
    ]
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BackButton style={styles.back} />
        <Text style={styles.title}>{uiLabel('edit profile')}</Text>
        <View style={styles.block}>
          <Section
            title="name"
            items={answers.name ? [answers.name] : []}
            onPress={() => navigation.navigate('EditProfileName')}
          />
          <Section
            title="goals"
            items={answers.futureSelf}
            itemColors={goalsColors}
            onPress={() => openField('futureSelf')}
          />
          <Section
            title="already proud"
            items={answers.alreadyProud}
            itemColors={proudColors}
            onPress={() => openField('alreadyProud')}
          />
          <Section
            title="hard mornings"
            items={answers.hardMornings}
            itemColors={hardMorningColors}
            onPress={() => openField('hardMornings')}
          />
          <Section
            title="voice tone"
            items={answers.voiceStyle ? [answers.voiceStyle] : []}
            itemColors={answers.voiceStyle ? voiceColors : undefined}
            onPress={() => openField('voiceStyle')}
          />
          <View style={styles.editRow}>
            <TextArrowButton
              label="update voice"
              color={accents.gold}
              onPress={() => navigation.navigate('VoiceRecord')}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  block: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'transparent',
    marginBottom: 32,
  },
  recapTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 20,
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
    ...noFakeBold,
  },
  editRow: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
});

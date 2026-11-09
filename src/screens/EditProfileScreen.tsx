import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { ForwardArrow } from '../components/ForwardArrow';
import { RecapPills } from '../components/RecapPills';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import {
  MORNING_HABIT_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';
import { deleteAccountOnServer } from '../services/apiAuth';
import { clearPersistedAppData } from '../services/resetApp';
import { logOutPurchases } from '../services/subscriptions';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold } from '../theme';
import { colorsForRecapSections } from '../utils/optionColors';
import { uiLabel } from '../utils/labels';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

type SectionProps = {
  title: string;
  items: string[];
  itemColors?: string[];
  onPress: () => void;
  keepCase?: boolean;
};

function Section({ title, items, itemColors, onPress, keepCase }: SectionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${items.length ? items.join(', ') : 'not set'}. Edit`}
      style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
    >
      {/* Whole row is the tap target; the arrow says "you can change this". */}
      <View style={styles.fieldHeader}>
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.recapTitle}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        <ForwardArrow color={colors.text} />
      </View>
      {items.length ? (
        <RecapPills items={items} colors={itemColors} keepCase={keepCase} />
      ) : null}
    </Pressable>
  );
}

export function EditProfileScreen({ navigation }: Props) {
  const { answers, resetOnboarding } = useOnboarding();
  const { clearAllAlarms } = useAlarms();
  const { resetAppSettings } = useAppSettings();
  const { clearMoodHistory } = useMoodCheckIn();
  const [deleting, setDeleting] = useState(false);

  const openField = (field: ProfileFieldKey) =>
    navigation.navigate('ProfileFieldEdit', { field });

  const wipeLocalAccount = async () => {
    await clearAllAlarms();
    await logOutPurchases();
    clearMoodHistory();
    resetAppSettings();
    await clearPersistedAppData();
    await resetOnboarding();
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This removes your Future Self account, voice clone, and profile from our servers. Alarms on this phone are cleared. Subscriptions are managed separately in Apple ID → Subscriptions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                // Preserve local data and the session until server deletion succeeds.
                await deleteAccountOnServer();
                await wipeLocalAccount();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Intro' }],
                });
              } catch (e) {
                Alert.alert(
                  'Could not delete',
                  userFacingError(
                    e,
                    'Try again, or email support from Menu.'
                  )
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  const [
    goalsColors,
    habitColors,
    hardMorningColors,
    voiceColors,
  ] = useMemo(
    () =>
      colorsForRecapSections([
        { items: answers.futureSelf, options: FUTURE_SELF_OPTIONS },
        { items: answers.morningHabits, options: MORNING_HABIT_OPTIONS },
        { items: answers.hardMornings, options: HARD_MORNING_OPTIONS },
        {
          items: answers.voiceStyle ? [answers.voiceStyle] : [],
          options: VOICE_STYLE_OPTIONS,
        },
      ]),
    [
      answers.futureSelf,
      answers.morningHabits,
      answers.hardMornings,
      answers.voiceStyle,
    ]
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BackButton style={styles.back} />
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>Account</Text>
        <View style={styles.block}>
          <Section
            title="name"
            keepCase
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
            title="morning habits"
            items={answers.morningHabits}
            itemColors={habitColors}
            onPress={() => openField('morningHabits')}
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
        </View>

        <View style={styles.danger}>
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.dangerTitle}>Delete account</Text>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.dangerBody}>
            Permanently erase your account, your voice clone and your answers
            from our servers. Subscriptions are managed in your Apple ID.
          </Text>
          {deleting ? (
            <ActivityIndicator color={colors.text} style={styles.deleteSpinner} />
          ) : (
            <View style={styles.editRow}>
              <TextArrowButton
                label="delete account"
                color={accents.danger}
                onPress={confirmDeleteAccount}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    paddingVertical: 10,
    gap: 8,
  },
  fieldPressed: {
    opacity: 0.6,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  block: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: colors.chip,
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
  voiceHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 16,
  },
  editRow: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  danger: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 40,
    backgroundColor: colors.chip,
  },
  dangerTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  dangerBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  deleteSpinner: {
    marginTop: 16,
    alignSelf: 'flex-end',
  },
});

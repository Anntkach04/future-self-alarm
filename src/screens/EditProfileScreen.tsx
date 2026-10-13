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
import { RecapPills } from '../components/RecapPills';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import {
  ALREADY_YOU_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';
import { deleteAccountOnServer } from '../services/apiAuth';
import { clearPersistedAppData } from '../services/resetApp';
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
  const { answers, resetOnboarding } = useOnboarding();
  const { clearAllAlarms } = useAlarms();
  const [deleting, setDeleting] = useState(false);

  const openField = (field: ProfileFieldKey) =>
    navigation.navigate('ProfileFieldEdit', { field });

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
                await deleteAccountOnServer();
                await clearAllAlarms();
                await clearPersistedAppData();
                await resetOnboarding();
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
        <Text style={styles.title}>{uiLabel('account')}</Text>
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
          <Text style={styles.voiceHint}>
            Re-record anytime. Your next alarm will use the new clone.
          </Text>
          <View style={styles.editRow}>
            <TextArrowButton
              label="update voice"
              color={accents.gold}
              onPress={() => navigation.navigate('VoiceRecord')}
            />
          </View>
        </View>

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerBody}>
            Permanently erase your account data on our servers. Required by App
            Store rules when you create an account.
          </Text>
          {deleting ? (
            <ActivityIndicator color={colors.text} style={styles.deleteSpinner} />
          ) : (
            <View style={styles.editRow}>
              <TextArrowButton
                label="delete account"
                color={accents.coral}
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
  voiceHint: {
    fontFamily: fonts.bodyLight,
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
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 18,
    marginBottom: 40,
  },
  dangerTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  dangerBody: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  deleteSpinner: {
    marginTop: 16,
    alignSelf: 'flex-end',
  },
});

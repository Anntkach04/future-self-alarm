import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlarmDayPicker } from '../components/AlarmDayPicker';
import { AppleTimePicker } from '../components/AppleTimePicker';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms, WEEKDAYS } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildAlarmAudioForId } from '../services/alarmGeneration';
import { scheduleAlarmNotifications } from '../services/alarmScheduler';
import { resolveVoiceId } from '../services/defaultVoice';
import { checkVoiceApiHealth } from '../services/elevenlabs';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAlarm'>;

export function CreateAlarmScreen({ navigation, route }: Props) {
  const { addAlarm, updateAlarm, alarms } = useAlarms();
  const { answers, voice, markOnboardingComplete, setVoiceId } = useOnboarding();
  const editingId = route.params?.alarmId;
  const existing = useMemo(
    () => alarms.find((a) => a.id === editingId),
    [alarms, editingId]
  );

  const [hour, setHour] = useState(existing?.hour ?? answers.wakeHour);
  const [minute, setMinute] = useState(existing?.minute ?? answers.wakeMinute);
  const [days, setDays] = useState<number[]>(
    existing?.days ?? (answers.wakeDays.length ? answers.wakeDays : [...WEEKDAYS])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistAnd = async (then: 'home' | 'another') => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const voiceId = resolveVoiceId(voice.voiceId);
      if (!voiceId) {
        setSaving(false);
        navigation.replace(voice.sampleUri ? 'VoiceCloning' : 'VoiceRecord');
        return;
      }
      if (!voice.voiceId) {
        setVoiceId(voiceId, true);
      }

      const health = await checkVoiceApiHealth();
      if (!health.hasKey && !health.elevenLabs) {
        throw new Error('Voice server is offline. Run npm run server.');
      }

      const payload = {
        hour,
        minute,
        label: 'Morning Future Self',
        enabled: true,
        days: days.length ? days : [...WEEKDAYS],
        snoozeMinutes: 10,
      };

      const alarmId = existing ? existing.id : addAlarm(payload).id;
      if (existing) {
        updateAlarm(existing.id, payload);
      }

      const { uri, text, systemSound } = await buildAlarmAudioForId({
        alarmId,
        voiceId,
        answers,
      });

      const saved = {
        id: alarmId,
        ...payload,
        audioUri: uri,
        scriptText: text,
      };
      updateAlarm(alarmId, { audioUri: uri, scriptText: text });
      await scheduleAlarmNotifications(saved, uri);
      if (!systemSound && Platform.OS === 'ios') {
        // Still scheduled via AlarmKit/default sound; warn softly in UI
        console.warn('Wake CAF missing — using default system alarm sound');
      }

      if (then === 'another') {
        navigation.replace('CreateAlarm');
        return;
      }
      markOnboardingComplete();
      navigation.replace('Home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save alarm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.page}>
        <BackButton style={styles.back} />
        <Text style={styles.title}>
          {uiLabel(existing ? 'edit alarm' : 'set up alarm')}
        </Text>
        <Text style={styles.hint}>
          Future Self sets a real iPhone alarm with your voice. Allow Alarm
          access when asked — it rings like Clock, even on Silent.
        </Text>

        <View style={styles.timeZone}>
          <AppleTimePicker
            compact
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
        </View>

        <View style={styles.repeatSection}>
          <AlarmDayPicker days={days} onChange={setDays} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {saving ? (
          <View style={styles.saving}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.savingText}>
              Building your morning voice…
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <TextArrowButton
            label="add alarm"
            color={accents.gold}
            onPress={() => void persistAnd('another')}
            disabled={saving}
          />
          <TextArrowButton
            label={existing ? 'save' : 'done'}
            color={colors.fab}
            onPress={() => void persistAnd('home')}
            disabled={saving}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  hint: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  timeZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    paddingVertical: spacing.lg,
  },
  repeatSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  error: {
    color: '#C0392B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  saving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  savingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
});

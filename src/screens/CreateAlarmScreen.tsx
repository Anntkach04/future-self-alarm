import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { AlarmDayPicker } from '../components/AlarmDayPicker';
import { AppleTimePicker } from '../components/AppleTimePicker';
import { BackButton } from '../components/BackButton';
import { LoadingLabel } from '../components/LoadingLabel';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { useAlarms, WEEKDAYS } from '../context/AlarmsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildAlarmAudioForId } from '../services/alarmGeneration';
import {
  playAlarmAudio,
  scheduleAlarmNotifications,
} from '../services/alarmScheduler';
import { resolveVoiceId, isPremadeDemoVoiceId } from '../services/defaultVoice';
import { checkVoiceApiHealth } from '../services/elevenlabs';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAlarm'>;

export function CreateAlarmScreen({ navigation, route }: Props) {
  const { addAlarm, updateAlarm, removeAlarm, alarms } = useAlarms();
  const { answers, voice, markOnboardingComplete, setVoiceId, clearVoice } =
    useOnboarding();
  const { today } = useMoodCheckIn();
  const { voiceLevel, bedLevel, isPaused } = useAppSettings();
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
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [snoozeEnabled, setSnoozeEnabled] = useState(
    existing?.snoozeEnabled ?? true
  );
  const [snoozeMinutes] = useState(existing?.snoozeMinutes ?? 10);
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
      if (voice.isDemo || isPremadeDemoVoiceId(voiceId)) {
        setSaving(false);
        setError(
          'This is a demo voice, not your clone. Re-record your voice first.'
        );
        return;
      }
      if (!voice.voiceId) {
        setVoiceId(voiceId, true);
      }

      const health = await checkVoiceApiHealth();
      if (!health.hasKey && !health.elevenLabs) {
        throw new Error(
          'Cannot reach the voice server. Check Wi-Fi, then try again.'
        );
      }

      const payload = {
        hour,
        minute,
        label: existing?.label ?? 'Morning Future Self',
        enabled,
        days: days.length ? days : [...WEEKDAYS],
        snoozeEnabled,
        snoozeMinutes,
      };

      const alarmId = existing ? existing.id : addAlarm(payload).id;
      if (existing) {
        updateAlarm(existing.id, payload);
      }

      const { uri, text, systemSound } = await buildAlarmAudioForId({
        alarmId,
        voiceId,
        answers,
        mood: today
          ? { label: today.moodLabel, note: today.note }
          : null,
        voiceLevel,
        bedLevel,
      });

      const saved = {
        id: alarmId,
        ...payload,
        audioUri: uri,
        scriptText: text,
      };
      updateAlarm(alarmId, { audioUri: uri, scriptText: text });
      if (!isPaused) {
        await scheduleAlarmNotifications(saved, uri);
      }
      if (!systemSound && Platform.OS === 'ios') {
        console.warn('Wake CAF missing — using notification without custom sound');
      }

      if (then === 'another') {
        navigation.replace('CreateAlarm');
        return;
      }
      markOnboardingComplete();
      navigation.replace('Home');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not save alarm';
      const missingVoice =
        /voice_not_found|voice with voice_id|A voice with voice_id/i.test(raw);
      if (missingVoice) {
        clearVoice();
        setError(
          'Your cloned voice is missing. Re-record your voice, then set the alarm again.'
        );
      } else {
        setError(userFacingError(e, 'Could not save alarm'));
      }
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
          Schedules a time-sensitive Future Self alert with your cloned voice —
          not a Clock.app alarm. Works locked and on Silent when alerts are
          allowed. Focus / Do Not Disturb can still block it unless Time
          Sensitive is on for this app.
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

        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Alarm on</Text>
            <Text style={styles.rowSub}>Off until you turn it back on</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.border, true: colors.text }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Keep waking me</Text>
            <Text style={styles.rowSub}>
              Rings again every {snoozeMinutes} min (system schedule) until you
              tap I&apos;m up
            </Text>
          </View>
          <Switch
            value={snoozeEnabled}
            onValueChange={setSnoozeEnabled}
            trackColor={{ false: colors.border, true: colors.text }}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {saving ? (
          <View style={styles.saving}>
            <ActivityIndicator color={colors.text} />
            <LoadingLabel
              text="Building your morning voice"
              style={styles.savingText}
            />
          </View>
        ) : null}

        {existing?.audioUri ? (
          <View style={styles.previewRow}>
            <TextArrowButton
              label="preview in 10s"
              color={accents.lime}
              onPress={() => {
                setTimeout(() => {
                  void playAlarmAudio(existing.audioUri!);
                }, 10_000);
              }}
              disabled={saving}
            />
          </View>
        ) : null}

        <View style={styles.footer}>
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete alarm"
              onPress={() => {
                removeAlarm(existing.id);
                navigation.goBack();
              }}
              style={styles.deleteBtn}
              disabled={saving}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ) : (
            <TextArrowButton
              label="add alarm"
              color={accents.gold}
              onPress={() => void persistAnd('another')}
              disabled={saving}
            />
          )}
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
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  rowSub: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  previewRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  deleteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: '#FF3B30',
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

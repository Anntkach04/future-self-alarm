import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { markRingPrepared } from '../services/eveningRegen';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AlarmDayPicker } from '../components/AlarmDayPicker';
import { AppleTimePicker } from '../components/AppleTimePicker';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { useAlarms, WEEKDAYS } from '../context/AlarmsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildAlarmAudioForId } from '../services/alarmGeneration';
import {
  ensureNotificationPermissions,
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
  const {
    answers,
    voice,
    onboardingComplete,
    markOnboardingComplete,
    setVoiceId,
    clearVoice,
  } = useOnboarding();
  const { today } = useMoodCheckIn();
  const { isPaused, setNotificationsReady } = useAppSettings();
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
  const [snoozeOn, setSnoozeOn] = useState(existing?.snoozeEnabled !== false);
  const [vibrate, setVibrate] = useState(existing?.vibrate ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  const daysRef = useRef(days);
  const snoozeOnRef = useRef(snoozeOn);
  const vibrateRef = useRef(vibrate);
  hourRef.current = hour;
  minuteRef.current = minute;
  daysRef.current = days;
  snoozeOnRef.current = snoozeOn;
  vibrateRef.current = vibrate;

  const leaveAfterSave = (then: 'home' | 'another') => {
    if (then === 'another') {
      navigation.replace('CreateAlarm');
      return;
    }
    if (!onboardingComplete) {
      markOnboardingComplete();
      navigation.replace('OnboardingCongrats');
      return;
    }
    navigation.replace('Home');
  };

  /** Voice + schedule after UI already left — never block Done on TTS. */
  const finishVoiceInBackground = (alarmId: string, payload: {
    hour: number;
    minute: number;
    label: string;
    enabled: boolean;
    days: number[];
    snoozeEnabled: boolean;
    snoozeMinutes: number;
    vibrate: boolean;
  }) => {
    void (async () => {
      const reuseUri = existing?.audioUri ?? null;
      let uri = reuseUri;
      let text = existing?.scriptText ?? null;

      // Ring is scheduled right away — with the current voice if we have one,
      // else the bundled fallback tone — so a slow or failed voice build can
      // never leave the alarm silent.
      if (!isPaused) {
        try {
          const allowed = await ensureNotificationPermissions();
          setNotificationsReady(allowed);
          await scheduleAlarmNotifications(
            { id: alarmId, ...payload, audioUri: uri, scriptText: text },
            uri
          );
        } catch (e) {
          console.warn('Initial alarm schedule failed', e);
        }
      }

      try {
        const voiceId = resolveVoiceId(voice.voiceId);
        if (!voiceId || voice.isDemo || isPremadeDemoVoiceId(voiceId)) return;

        // Reuse voice when only time/days/snooze changed.
        if (!uri) {
          const { ensureGuestSession } = await import('../services/apiAuth');
          await ensureGuestSession();
          const health = await checkVoiceApiHealth();
          if (!health.hasKey && !health.elevenLabs) {
            throw new Error('Voice service unavailable');
          }

          const built = await buildAlarmAudioForId({
            alarmId,
            voiceId,
            answers,
            mood: today
              ? { label: today.moodLabel, note: today.note }
              : null,
          });
          uri = built.uri;
          text = built.text;
          updateAlarm(alarmId, {
            audioUri: uri,
            scriptText: text,
            voiceFailed: false,
          });
          // Counts as this ring's message — the prep window won't rebuild it.
          void markRingPrepared(
            { id: alarmId, ...payload, audioUri: uri, scriptText: text },
            today ? { label: today.moodLabel, note: today.note } : null
          );
        }

        if (isPaused || !uri) return;
        const allowed = await ensureNotificationPermissions();
        setNotificationsReady(allowed);
        await scheduleAlarmNotifications(
          {
            id: alarmId,
            ...payload,
            audioUri: uri,
            scriptText: text,
          },
          uri
        );
      } catch (e) {
        console.warn('Background alarm voice failed', e);
        // Visible on Home; the alarm still rings with the fallback tone.
        if (!uri) updateAlarm(alarmId, { voiceFailed: true });
      }
    })();
  };

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

      const payload = {
        hour: hourRef.current,
        minute: minuteRef.current,
        label: existing?.label ?? 'Morning Future Self',
        enabled: existing?.enabled ?? true,
        days: daysRef.current.length ? [...daysRef.current] : [...WEEKDAYS],
        snoozeEnabled: snoozeOnRef.current,
        snoozeMinutes: 10,
        vibrate: vibrateRef.current,
      };

      const alarmId = existing ? existing.id : addAlarm(payload).id;
      if (existing) {
        updateAlarm(existing.id, payload);
      }

      // Leave immediately — voice builds in the background.
      leaveAfterSave(then);
      finishVoiceInBackground(alarmId, payload);
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
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.page}>
        <BackButton style={styles.back} />
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>
          {uiLabel(existing ? 'edit alarm' : 'set up alarm')}
        </Text>

        <View style={styles.timeZone}>
          <AppleTimePicker
            compact
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              hourRef.current = h;
              minuteRef.current = m;
              setHour(h);
              setMinute(m);
            }}
          />
        </View>

        <View style={styles.repeatSection}>
          <AlarmDayPicker
            days={days}
            onChange={(next) => {
              daysRef.current = next;
              setDays(next);
            }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.rowTitle}>snooze</Text>
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.rowSub}>
              Rings again every 10 minutes until you tap I’m up
            </Text>
          </View>
          <Switch
            value={snoozeOn}
            onValueChange={(v) => {
              snoozeOnRef.current = v;
              setSnoozeOn(v);
            }}
            trackColor={{ false: colors.border, true: colors.text }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.rowTitle}>vibrate</Text>
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.rowSub}>
              Buzz when your future self starts talking
            </Text>
          </View>
          <Switch
            value={vibrate}
            onValueChange={(v) => {
              vibrateRef.current = v;
              setVibrate(v);
            }}
            trackColor={{ false: colors.border, true: colors.text }}
          />
        </View>

        {error ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text> : null}

        <View style={[styles.footer, !existing && styles.footerSingle]}>
          {existing ? (
            <TextArrowButton
              label="delete"
              color={accents.coral}
              onPress={() => {
                removeAlarm(existing.id);
                navigation.goBack();
              }}
              disabled={saving}
            />
          ) : null}
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
    paddingTop: spacing.md,
  },
  back: {
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    marginBottom: 12,
    ...noFakeBold,
  },
  timeZone: {
    marginBottom: 8,
  },
  repeatSection: {
    marginBottom: 16,
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
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 20,
    color: colors.text,
    ...noFakeBold,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: accents.coral,
    marginTop: 8,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  footerSingle: {
    justifyContent: 'flex-end',
  },
});

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Alarm } from '../context/AlarmsContext';
import { EVERY_DAY } from '../context/AlarmsContext';

const SCHEDULE_AHEAD = 14;
let playback: Audio.Sound | null = null;
let handlersReady = false;

export function isFutureSelfAlarmData(
  data: unknown
): data is {
  alarmId: string;
  audioUri?: string;
  type: 'future-self-alarm';
  snoozeMinutes?: number;
} {
  if (!data || typeof data !== 'object') return false;
  const row = data as Record<string, unknown>;
  return row.type === 'future-self-alarm' && typeof row.alarmId === 'string';
}

async function configureAudioForAlarm() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  });
}

async function stopPlayback() {
  if (!playback) return;
  try {
    await playback.stopAsync();
    await playback.unloadAsync();
  } catch {
    // ignore
  }
  playback = null;
}

export async function playAlarmAudio(uri: string) {
  if (!uri || Platform.OS === 'web') return;
  await configureAudioForAlarm();
  await stopPlayback();
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume: 1, isLooping: false }
  );
  playback = sound;
}

export async function ensureNotificationPermissions() {
  if (Platform.OS === 'web') return true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarms', {
      name: 'Future Self alarms',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return Boolean(requested.granted);
}

function jsDayToAlarmDay(jsDay: number) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function alarmDays(alarm: Alarm) {
  return alarm.days.length ? alarm.days : [...EVERY_DAY];
}

export function nextAlarmOccurrences(alarm: Alarm, count = SCHEDULE_AHEAD) {
  const out: Date[] = [];
  const now = new Date();
  const days = alarmDays(alarm);

  for (let offset = 0; offset < 28 && out.length < count; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const alarmDay = jsDayToAlarmDay(day.getDay());
    if (!days.includes(alarmDay)) continue;

    const fire = new Date(day);
    fire.setHours(alarm.hour, alarm.minute, 0, 0);
    if (fire.getTime() <= now.getTime()) continue;
    out.push(fire);
  }

  return out.slice(0, count);
}

function notificationId(alarmId: string, index: number) {
  return `fs_alarm_${alarmId}_${index}`;
}

export async function cancelScheduledAlarm(alarmId: string) {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const mine = scheduled.filter(
    (item) =>
      item.identifier.startsWith(`fs_alarm_${alarmId}_`) ||
      item.identifier === snoozeId(alarmId)
  );
  await Promise.all(
    mine.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier)
    )
  );
}

export async function scheduleAlarmNotifications(
  alarm: Alarm,
  audioUri: string | null
) {
  if (Platform.OS === 'web') return;
  if (!alarm.enabled) {
    await cancelScheduledAlarm(alarm.id);
    return;
  }

  const ok = await ensureNotificationPermissions();
  if (!ok) {
    throw new Error(
      'Notifications are off. Allow alerts so Future Self can wake you.'
    );
  }

  await cancelScheduledAlarm(alarm.id);
  const times = nextAlarmOccurrences(alarm);

  await Promise.all(
    times.map((date, index) =>
      Notifications.scheduleNotificationAsync({
        identifier: notificationId(alarm.id, index),
        content: {
          title: 'Future You',
          body: alarm.label || 'Your morning message is ready.',
          sound: Platform.OS === 'android' ? 'default' : true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          interruptionLevel: 'timeSensitive',
          data: {
            type: 'future-self-alarm',
            alarmId: alarm.id,
            audioUri: audioUri || undefined,
            snoozeMinutes: alarm.snoozeMinutes || 10,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: Platform.OS === 'android' ? 'alarms' : undefined,
        },
      })
    )
  );
}

async function handleAlarmNotification(
  notification: Notifications.Notification
) {
  const data = notification.request.content.data;
  if (!isFutureSelfAlarmData(data)) return;
  const uri = typeof data.audioUri === 'string' ? data.audioUri : null;
  if (uri) await playAlarmAudio(uri);
  const snoozeMin =
    typeof data.snoozeMinutes === 'number' && data.snoozeMinutes > 0
      ? data.snoozeMinutes
      : 10;
  await scheduleSnooze(data.alarmId, uri, snoozeMin);
  emitRinging({ alarmId: data.alarmId, audioUri: uri });
}

function snoozeId(alarmId: string) {
  return `fs_snooze_${alarmId}`;
}

export async function scheduleSnooze(
  alarmId: string,
  audioUri: string | null,
  minutes = 10
) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(snoozeId(alarmId)).catch(
    () => undefined
  );
  const fire = new Date(Date.now() + minutes * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: snoozeId(alarmId),
    content: {
      title: 'Future You',
      body: 'Still here - whenever you’re ready.',
      sound: Platform.OS === 'android' ? 'default' : true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      data: {
        type: 'future-self-alarm',
        alarmId,
        audioUri: audioUri || undefined,
        snoozeMinutes: minutes,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fire,
      channelId: Platform.OS === 'android' ? 'alarms' : undefined,
    },
  });
}

export async function dismissAlarm(alarmId: string) {
  await stopPlayback();
  if (Platform.OS !== 'web') {
    await Notifications.cancelScheduledNotificationAsync(snoozeId(alarmId)).catch(
      () => undefined
    );
  }
  emitRinging(null);
}

type RingingState = { alarmId: string; audioUri: string | null } | null;
type RingListener = (next: RingingState) => void;
const ringListeners = new Set<RingListener>();

function emitRinging(next: RingingState) {
  ringListeners.forEach((fn) => fn(next));
}

export function subscribeAlarmRing(listener: RingListener) {
  ringListeners.add(listener);
  return () => {
    ringListeners.delete(listener);
  };
}

export function initAlarmNotifications() {
  if (handlersReady || Platform.OS === 'web') return;
  handlersReady = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      if (isFutureSelfAlarmData(data) && typeof data.audioUri === 'string') {
        await playAlarmAudio(data.audioUri);
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  Notifications.addNotificationReceivedListener((event) => {
    void handleAlarmNotification(event);
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleAlarmNotification(response.notification);
  });
}

export async function rescheduleAllAlarms(
  alarms: Alarm[],
  audioByAlarmId: Record<string, string | null>
) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    alarms.map((alarm) =>
      scheduleAlarmNotifications(alarm, audioByAlarmId[alarm.id] ?? null)
    )
  );
}

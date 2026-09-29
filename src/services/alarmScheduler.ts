import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Alarm } from '../context/AlarmsContext';
import { EVERY_DAY } from '../context/AlarmsContext';
import {
  alarmSoundBaseName,
  alarmSoundFileName,
  alarmSoundPath,
} from './alarmSoundFile';
import { librarySoundExists } from '../../modules/ios-library-sounds/src';

const SCHEDULE_AHEAD = 14;
const APP_GROUP = 'group.com.anonymous.future-self-alarm';

let playback: AudioPlayer | null = null;
let handlersReady = false;
let alarmKitReady: boolean | null = null;

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
  await setAudioModeAsync({
    allowsRecording: false,
    shouldPlayInBackground: true,
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
  });
}

async function stopPlayback() {
  if (!playback) return;
  try {
    playback.pause();
    playback.remove();
  } catch {
    // ignore
  }
  playback = null;
}

export async function playAlarmAudio(uri: string) {
  if (!uri || Platform.OS === 'web') return;
  await configureAudioForAlarm();
  await stopPlayback();
  const player = createAudioPlayer({ uri });
  player.volume = 1;
  player.play();
  playback = player;
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

/** Deterministic UUID so AlarmKit accepts our alarm_* ids. */
export function alarmKitUUID(alarmId: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;
  for (let i = 0; i < alarmId.length; i += 1) {
    const c = alarmId.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i * 17;
    h2 = Math.imul(h2, 0x01000193);
    h3 ^= c * 31 + i;
    h3 = Math.imul(h3, 0x01000193);
    h4 ^= (c << (i % 8)) + i;
    h4 = Math.imul(h4, 0x01000193);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const a = hex(h1) + hex(h2) + hex(h3) + hex(h4);
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-4${a.slice(13, 16)}-a${a.slice(17, 20)}-${a.slice(20, 32)}`;
}

/** Our days: 0=Mon…6=Sun → AlarmKit: 1=Sun…7=Sat */
function toAlarmKitWeekdays(days: number[]) {
  return days.map((d) => (d === 6 ? 1 : d + 2));
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

function snoozeId(alarmId: string) {
  return `fs_snooze_${alarmId}`;
}

async function loadAlarmKit() {
  if (Platform.OS !== 'ios') return null;
  try {
    // expo-alarm-kit is not linked below iOS 26.1 — requireNativeModule would
    // crash the app as a fatal JS exception. Probe first, then import.
    const { requireOptionalNativeModule } = await import('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoAlarmKit')) {
      return null;
    }
    return await import('expo-alarm-kit');
  } catch {
    return null;
  }
}

export async function ensureAlarmKitReady() {
  if (Platform.OS !== 'ios') {
    alarmKitReady = false;
    return false;
  }
  if (alarmKitReady != null) return alarmKitReady;
  const kit = await loadAlarmKit();
  if (!kit) {
    alarmKitReady = false;
    return false;
  }
  try {
    // App Groups may be unavailable on free teams — still try to authorize.
    try {
      kit.configure(APP_GROUP);
    } catch {
      /* ignore */
    }
    const status = await kit.requestAuthorization();
    alarmKitReady = status === 'authorized';
    return alarmKitReady;
  } catch (error) {
    console.warn('AlarmKit unavailable', error);
    alarmKitReady = false;
    return false;
  }
}

async function cancelAlarmKit(alarmId: string) {
  const kit = await loadAlarmKit();
  if (!kit) return;
  try {
    await kit.cancelAlarm(alarmKitUUID(alarmId));
  } catch {
    // ignore
  }
}

export async function cancelScheduledAlarm(alarmId: string) {
  if (Platform.OS === 'web') return;
  await cancelAlarmKit(alarmId);
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

function notificationSoundFor(alarmId: string, hasSystemSound: boolean) {
  if (Platform.OS === 'android') return 'default';
  if (!hasSystemSound) return true;
  // iOS looks up Library/Sounds/<name>
  return alarmSoundFileName(alarmId);
}

async function scheduleNotificationFallback(
  alarm: Alarm,
  audioUri: string | null,
  hasSystemSound: boolean
) {
  const ok = await ensureNotificationPermissions();
  if (!ok) {
    throw new Error(
      'Notifications are off. Allow alerts so Future Self can wake you.'
    );
  }

  const times = nextAlarmOccurrences(alarm);
  const sound = notificationSoundFor(alarm.id, hasSystemSound);
  const body = notificationBodyFor(alarm);

  await Promise.all(
    times.map((date, index) =>
      Notifications.scheduleNotificationAsync({
        identifier: notificationId(alarm.id, index),
        content: {
          title: 'Future You',
          body,
          sound,
          priority: Notifications.AndroidNotificationPriority.MAX,
          interruptionLevel: 'timeSensitive',
          vibrate: [0, 400, 200, 400, 200, 400],
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

function notificationBodyFor(alarm: Alarm) {
  const script = String(alarm.scriptText || '').replace(/\s+/g, ' ').trim();
  if (script.length > 40) {
    return script.length > 160 ? `${script.slice(0, 157).trim()}…` : script;
  }
  return 'Your morning voice is ready. Open when you’re up.';
}

async function scheduleWithAlarmKit(
  alarm: Alarm,
  hasSystemSound: boolean
): Promise<boolean> {
  const kit = await loadAlarmKit();
  if (!kit) return false;
  const ready = await ensureAlarmKitReady();
  if (!ready) return false;

  const id = alarmKitUUID(alarm.id);
  // Prefer per-alarm CAF; fall back to shared FutureYouWake.caf (same mix).
  // Always pass the .caf extension — AlarmKit needs it to resolve Library/Sounds.
  const soundName = hasSystemSound
    ? alarmSoundBaseName(alarm.id)
    : undefined;
  const weekdays = toAlarmKitWeekdays(alarmDays(alarm));
  const snoozeSec = Math.max(60, (alarm.snoozeMinutes || 10) * 60);

  try {
    await kit.cancelAlarm(id).catch(() => undefined);

    const trySchedule = async (name?: string) =>
      kit.scheduleRepeatingAlarm({
        id,
        hour: alarm.hour,
        minute: alarm.minute,
        weekdays,
        title: 'Future You',
        soundName: name,
        launchAppOnDismiss: true,
        dismissPayload: alarm.id,
        doSnoozeIntent: true,
        launchAppOnSnooze: true,
        snoozePayload: alarm.id,
        snoozeDuration: snoozeSec,
        tintColor: '#BADFFF',
        stopButtonLabel: "I'm up",
        snoozeButtonLabel: 'Snooze',
      });

    let ok = await trySchedule(soundName);
    if (!ok && soundName && soundName !== 'FutureYouWake.caf') {
      ok = await trySchedule('FutureYouWake.caf');
    }
    // Still schedule a loud system alarm rather than falling through to a banner.
    if (!ok && soundName) {
      ok = await trySchedule(undefined);
    }
    return Boolean(ok);
  } catch (error) {
    console.warn('AlarmKit schedule failed', error);
    return false;
  }
}

/**
 * Schedule a real wake (Clock-style), not a soft banner.
 *
 * Priority on iOS 26.1+:
 * 1) AlarmKit — full-screen alarm UI, rings through Silent / Focus
 *    (custom CAF from Library/Sounds when installed)
 * 2) Local notification + CAF — only if AlarmKit unavailable / denied
 */
export async function scheduleAlarmNotifications(
  alarm: Alarm,
  audioUri: string | null
) {
  if (Platform.OS === 'web') return;
  if (!alarm.enabled) {
    await cancelScheduledAlarm(alarm.id);
    return;
  }

  const soundPath = alarmSoundPath(alarm.id);
  let hasSystemSound = false;
  if (Platform.OS === 'ios') {
    hasSystemSound = await librarySoundExists(alarmSoundFileName(alarm.id));
    if (!hasSystemSound) {
      // Same mix also written as a stable name for AlarmKit resolution.
      hasSystemSound = await librarySoundExists('FutureYouWake.caf');
    }
  } else if (soundPath) {
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(soundPath);
    hasSystemSound = Boolean(info.exists);
  }

  await cancelScheduledAlarm(alarm.id);

  const usedKit = await scheduleWithAlarmKit(alarm, hasSystemSound);
  if (usedKit) return;

  await scheduleNotificationFallback(alarm, audioUri, hasSystemSound);
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
  await scheduleSnooze(data.alarmId, uri, snoozeMin, true);
  emitRinging({ alarmId: data.alarmId, audioUri: uri });
}

export async function scheduleSnooze(
  alarmId: string,
  audioUri: string | null,
  minutes = 10,
  hasSystemSound = true
) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(snoozeId(alarmId)).catch(
    () => undefined
  );
  const fire = new Date(Date.now() + minutes * 60 * 1000);
  const soundPath = alarmSoundPath(alarmId);
  let soundOk = hasSystemSound;
  if (Platform.OS === 'ios') {
    soundOk = await librarySoundExists(alarmSoundFileName(alarmId));
  } else if (soundPath) {
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(soundPath);
    soundOk = info.exists;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: snoozeId(alarmId),
    content: {
      title: 'Future You',
      body: 'Still here — your voice again.',
      sound: notificationSoundFor(alarmId, soundOk),
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

  void ensureAlarmKitReady();

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      // Custom CAF already plays via the notification sound when backgrounded.
      // When foregrounded, also play the full mix.
      if (isFutureSelfAlarmData(data) && typeof data.audioUri === 'string') {
        await playAlarmAudio(data.audioUri);
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
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

/** Handle app opened from AlarmKit dismiss/snooze. */
export async function consumeAlarmKitLaunch(audioByAlarmId: Record<string, string | null>) {
  if (Platform.OS !== 'ios') return;
  const kit = await loadAlarmKit();
  if (!kit) return;
  try {
    const payload = kit.getLaunchPayload();
    if (!payload?.alarmId && !payload?.payload) return;
    const logicalId =
      (typeof payload.payload === 'string' && payload.payload) ||
      null;
    const alarmId = logicalId;
    if (!alarmId) return;
    const uri = audioByAlarmId[alarmId] ?? null;
    if (uri) await playAlarmAudio(uri);
    emitRinging({ alarmId, audioUri: uri });
  } catch {
    // ignore
  }
}

export async function rescheduleAllAlarms(
  alarms: Alarm[],
  audioByAlarmId: Record<string, string | null>
) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    alarms
      .filter((alarm) => alarm.enabled && audioByAlarmId[alarm.id])
      .map((alarm) =>
        scheduleAlarmNotifications(alarm, audioByAlarmId[alarm.id] ?? null)
      )
  );
}

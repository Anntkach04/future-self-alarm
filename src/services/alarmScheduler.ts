import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Alarm } from '../context/AlarmsContext';
import {
  alarmSoundBaseName,
  alarmSoundFileName,
  alarmSoundPath,
} from './alarmSoundFile';
import { librarySoundExists } from '../../modules/ios-library-sounds/src';

/** Local copy — avoid require cycle with AlarmsContext. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const SCHEDULE_AHEAD = 7;
/** Follow-ups after the *next* wake only (system-level, app can be killed). */
const SNOOZE_CHAIN = 6;
/**
 * Bundled CAF registered via expo-notifications `sounds` in app.json.
 * Used when the per-alarm AI CAF is missing or corrupt — never silent.
 */
export const FALLBACK_WAKE_SOUND = 'fs_fallback.caf';
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
  snoozeEnabled?: boolean;
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

/** Read-only check — never prompts. Use from silent schedule paths. */
export async function hasNotificationPermissions() {
  if (Platform.OS === 'web') return true;
  const current = await Notifications.getPermissionsAsync();
  return Boolean(
    current.granted ||
      current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/** UI screens only — may show the system permission sheet. */
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

  if (await hasNotificationPermissions()) return true;

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

/** Legacy single snooze id (cancelled on dismiss for back-compat). */
function snoozeId(alarmId: string) {
  return `fs_snooze_${alarmId}`;
}

function snoozeChainId(alarmId: string, occurrence: number, step: number) {
  return `fs_snooze_${alarmId}_${occurrence}_${step}`;
}

function isOurSnoozeId(identifier: string, alarmId: string) {
  return (
    identifier === snoozeId(alarmId) ||
    identifier.startsWith(`fs_snooze_${alarmId}_`)
  );
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
      isOurSnoozeId(item.identifier, alarmId)
  );
  await Promise.all(
    mine.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier)
    )
  );
}

/**
 * iOS notification sound name:
 * - Custom AI CAF in Library/Sounds when present
 * - Else bundled `fs_fallback.caf` (never silent / never rely on corrupt file)
 */
function notificationSoundFor(alarmId: string, hasSystemSound: boolean) {
  // Android channel uses default; custom CAF path is iOS Library/Sounds + bundle.
  if (Platform.OS === 'android') return 'default';
  if (hasSystemSound) {
    // iOS looks up Library/Sounds/<name> then the app bundle
    return alarmSoundFileName(alarmId);
  }
  return FALLBACK_WAKE_SOUND;
}

async function scheduleOneWakeNotification(params: {
  identifier: string;
  date: Date;
  alarmId: string;
  body: string;
  sound: string | boolean;
  audioUri: string | null;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  kind: 'wake' | 'snooze';
}) {
  await Notifications.scheduleNotificationAsync({
    identifier: params.identifier,
    content: {
      title: 'Future You',
      body:
        params.kind === 'snooze'
          ? 'Still here. Your voice again.'
          : params.body,
      sound: params.sound,
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      vibrate: [0, 400, 200, 400, 200, 400],
      data: {
        type: 'future-self-alarm',
        alarmId: params.alarmId,
        audioUri: params.audioUri || undefined,
        snoozeEnabled: params.snoozeEnabled,
        snoozeMinutes: params.snoozeMinutes,
        kind: params.kind,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.date,
      channelId: Platform.OS === 'android' ? 'alarms' : undefined,
    },
  });
}

async function scheduleNotificationFallback(
  alarm: Alarm,
  audioUri: string | null,
  hasSystemSound: boolean
) {
  // Silent path: never pop the permission sheet mid-session (looks like a hang).
  const ok = await hasNotificationPermissions();
  if (!ok) {
    throw new Error(
      'Notifications are off. Allow alerts so Future Self can wake you.'
    );
  }

  const times = nextAlarmOccurrences(alarm);
  const sound = notificationSoundFor(alarm.id, hasSystemSound);
  const body = notificationBodyFor(alarm);
  const snoozeOn = alarm.snoozeEnabled !== false;
  const snoozeMin =
    typeof alarm.snoozeMinutes === 'number' && alarm.snoozeMinutes > 0
      ? alarm.snoozeMinutes
      : 10;

  // Main wakes in parallel. Snooze chain only for the soonest occurrence —
  // scheduling 14×6 follow-ups froze the UI on launch.
  const jobs: Promise<unknown>[] = times.map((date, index) =>
    scheduleOneWakeNotification({
      identifier: notificationId(alarm.id, index),
      date,
      alarmId: alarm.id,
      body,
      sound,
      audioUri,
      snoozeEnabled: snoozeOn,
      snoozeMinutes: snoozeMin,
      kind: 'wake',
    })
  );

  if (snoozeOn && times[0]) {
    const nextWake = times[0];
    for (let step = 1; step <= SNOOZE_CHAIN; step += 1) {
      const follow = new Date(nextWake.getTime() + step * snoozeMin * 60 * 1000);
      jobs.push(
        scheduleOneWakeNotification({
          identifier: snoozeChainId(alarm.id, 0, step),
          date: follow,
          alarmId: alarm.id,
          body,
          sound,
          audioUri,
          snoozeEnabled: true,
          snoozeMinutes: snoozeMin,
          kind: 'snooze',
        })
      );
    }
  }

  await Promise.all(jobs);
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
  // Never schedule AlarmKit without a custom CAF — bare Kit plays the
  // default system tone instead of (or on top of) your voice.
  if (!hasSystemSound) return false;

  const kit = await loadAlarmKit();
  if (!kit) return false;
  const ready = await ensureAlarmKitReady();
  if (!ready) return false;

  const id = alarmKitUUID(alarm.id);
  const withExt = alarmSoundBaseName(alarm.id);
  const withoutExt = withExt.replace(/\.caf$/i, '');
  const weekdays = toAlarmKitWeekdays(alarmDays(alarm));
  const snoozeOn = alarm.snoozeEnabled !== false;
  const snoozeSec = Math.max(60, (alarm.snoozeMinutes || 10) * 60);

  try {
    await kit.cancelAlarm(id).catch(() => undefined);

    const trySchedule = async (name: string) =>
      kit.scheduleRepeatingAlarm({
        id,
        hour: alarm.hour,
        minute: alarm.minute,
        weekdays,
        title: 'Future You',
        soundName: name,
        launchAppOnDismiss: true,
        dismissPayload: alarm.id,
        doSnoozeIntent: snoozeOn,
        launchAppOnSnooze: snoozeOn,
        snoozePayload: alarm.id,
        snoozeDuration: snoozeSec,
        tintColor: '#BADFFF',
        stopButtonLabel: "I'm up",
        snoozeButtonLabel: 'Later',
      });

    // Prefer AlarmKit = real system alarm UI with YOUR CAF (not a chat push).
    if (await trySchedule(withExt)) return true;
    if (withoutExt !== withExt && (await trySchedule(withoutExt))) return true;
    return false;
  } catch (error) {
    console.warn('AlarmKit schedule failed', error);
    return false;
  }
}

export type ScheduleWakeResult = {
  /** Custom voice CAF is in Library/Sounds (iOS) / ready for notification sound. */
  hasCustomVoice: boolean;
  /**
   * How the wake was scheduled.
   * - `notification`: your voice CAF via local alert (correct for dynamic clones)
   * - `alarmkit`: system AlarmKit UI (sound must be in the app bundle; we only
   *    use this when a resolvable custom file exists AND Kit accepts it)
   * - `both`: Kit scheduled for authority/UI + notification carries your voice
   * - `none`: disabled / web
   */
  mode: 'notification' | 'alarmkit' | 'both' | 'none';
};

/**
 * iOS reality for a *cloned* voice wake (see docs/ALARM_ENGINE.md):
 * - Dynamic CAF (≤28s) → Library/Sounds → UNNotificationSound on lock screen.
 * - Full AI MP3 plays in-app when the notification opens the app.
 * - AlarmKit `.named(sound)` is unreliable for Library/Sounds clones (often
 *   default tone), so we schedule notification + system follow-up chain only.
 * - Missing/corrupt CAF → bundled `fs_fallback.caf`.
 * - Min iOS is 26.1 (AlarmKit-era); we do not ship a ≤25 limited mode.
 */
export async function scheduleAlarmNotifications(
  alarm: Alarm,
  audioUri: string | null
): Promise<ScheduleWakeResult> {
  if (Platform.OS === 'web') {
    return { hasCustomVoice: false, mode: 'none' };
  }
  if (!alarm.enabled) {
    await cancelScheduledAlarm(alarm.id);
    return { hasCustomVoice: false, mode: 'none' };
  }

  const soundPath = alarmSoundPath(alarm.id);
  let hasSystemSound = false;
  if (Platform.OS === 'ios') {
    hasSystemSound = await librarySoundExists(alarmSoundFileName(alarm.id));
  } else if (soundPath) {
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(soundPath);
    hasSystemSound = Boolean(info.exists);
  }

  await cancelScheduledAlarm(alarm.id);

  // Do not request AlarmKit here — cloned wakes use notifications + CAF.
  // AlarmKit auth is only prompted inside scheduleWithAlarmKit when used.

  await scheduleNotificationFallback(alarm, audioUri, hasSystemSound);
  return {
    hasCustomVoice: hasSystemSound,
    mode: 'notification',
  };
}

async function handleAlarmNotification(
  notification: Notifications.Notification
) {
  const data = notification.request.content.data;
  if (!isFutureSelfAlarmData(data)) return;
  const uri = typeof data.audioUri === 'string' ? data.audioUri : null;
  // Full MP3 when the app is awake (can be longer than the ≤28s lock-screen CAF).
  if (uri) {
    try {
      await playAlarmAudio(uri);
    } catch (error) {
      console.warn('Alarm audio playback failed; lock-screen sound already played', error);
    }
  }
  emitRinging({ alarmId: data.alarmId, audioUri: uri });
  // Follow-ups are pre-scheduled at schedule time (system-level). Do not
  // schedule another JS-dependent snooze here — that failed when the app
  // was killed and double-fired when it was open.
}

function triggerDateMs(
  trigger: Notifications.NotificationTrigger | null
): number | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const row = trigger as { type?: string; date?: number | Date };
  if (row.date == null) return null;
  return typeof row.date === 'number'
    ? row.date
    : new Date(row.date).getTime();
}

/**
 * Cancel near-term follow-ups for this morning without wiping tomorrow's chain.
 * Horizon covers SNOOZE_CHAIN steps at up to 15 min each + buffer.
 */
async function cancelNearTermSnoozes(alarmId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const horizonMs = Date.now() + (SNOOZE_CHAIN + 2) * 15 * 60 * 1000;
  await Promise.all(
    scheduled
      .filter((item) => isOurSnoozeId(item.identifier, alarmId))
      .filter((item) => {
        const when = triggerDateMs(item.trigger);
        return when == null || when <= horizonMs;
      })
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier)
      )
  );
}

/** Manual one-shot follow-up (e.g. future "Later" control). Prefers system chain. */
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
  await scheduleOneWakeNotification({
    identifier: snoozeId(alarmId),
    date: fire,
    alarmId,
    body: 'Still here. Your voice again.',
    sound: notificationSoundFor(alarmId, soundOk),
    audioUri,
    snoozeEnabled: true,
    snoozeMinutes: minutes,
    kind: 'snooze',
  });
}

/**
 * Stop in-app playback and cancel near-term system follow-ups.
 * - Notification path: cancels pre-scheduled snooze chain for this morning.
 * - AlarmKit path (if used): cancels via native AlarmKit + App Intent storage.
 * Note: iOS cannot interrupt an already-playing UNNotificationSound mid-clip;
 * "I'm up" stops our AV player and prevents the next rings.
 */
export async function dismissAlarm(alarmId: string) {
  await stopPlayback();
  if (Platform.OS !== 'web') {
    await cancelNearTermSnoozes(alarmId);
    await cancelAlarmKit(alarmId);
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      await Promise.all(
        presented
          .filter((n) => {
            const data = n.request.content.data;
            return isFutureSelfAlarmData(data) && data.alarmId === alarmId;
          })
          .map((n) =>
            Notifications.dismissNotificationAsync(n.request.identifier)
          )
      );
    } catch {
      // ignore
    }
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
    handleNotification: async () => {
      // Playback + snooze live in the received listener only (avoid double play).
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

let rescheduleInFlight: Promise<void> | null = null;
let rescheduleQueued:
  | {
      alarms: Alarm[];
      audioByAlarmId: Record<string, string | null>;
    }
  | null = null;

async function rescheduleAllAlarmsOnce(
  alarms: Alarm[],
  audioByAlarmId: Record<string, string | null>
) {
  await Promise.all(
    alarms.map(async (alarm) => {
      if (!alarm.enabled) {
        await cancelScheduledAlarm(alarm.id);
        return;
      }
      await scheduleAlarmNotifications(
        alarm,
        audioByAlarmId[alarm.id] ?? null
      );
    })
  );
}

export async function rescheduleAllAlarms(
  alarms: Alarm[],
  audioByAlarmId: Record<string, string | null>
) {
  if (Platform.OS === 'web') return;
  // Coalesce overlapping runs so launch + toggle + regen don't pile up.
  if (rescheduleInFlight) {
    rescheduleQueued = { alarms, audioByAlarmId };
    await rescheduleInFlight;
    return;
  }
  rescheduleInFlight = (async () => {
    let next = { alarms, audioByAlarmId };
    try {
      for (;;) {
        await rescheduleAllAlarmsOnce(next.alarms, next.audioByAlarmId);
        if (!rescheduleQueued) break;
        next = rescheduleQueued;
        rescheduleQueued = null;
      }
    } finally {
      rescheduleInFlight = null;
    }
  })();
  await rescheduleInFlight;
}

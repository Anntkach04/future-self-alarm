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
/** iOS keeps only the soonest 64 pending local notifications per app. */
const IOS_PENDING_LIMIT = 64;
/** Leave room for test wakes / one-off snoozes. */
const NOTIFICATION_HEADROOM = 4;
const MAX_SCHEDULE_AHEAD = 14;

/** Enabled alarms that may need the notification path (set on reschedule). */
let enabledAlarmCount = 1;

/**
 * Split the 64-notification budget across alarms so none is silently dropped.
 * 1 alarm → 14 days + 6 follow-ups; 5 → 6 + 6; 10 → 2 + 4.
 */
function notificationBudget() {
  const n = Math.max(1, enabledAlarmCount);
  const perAlarm = Math.max(
    2,
    Math.floor((IOS_PENDING_LIMIT - NOTIFICATION_HEADROOM) / n)
  );
  const snooze = Math.min(SNOOZE_CHAIN, Math.max(1, perAlarm - 2));
  const ahead = Math.max(1, Math.min(MAX_SCHEDULE_AHEAD, perAlarm - snooze));
  return { ahead, snooze };
}
/** Follow-ups after the *next* wake only (system-level, app can be killed). */
const SNOOZE_CHAIN = 6;
/**
 * Bundled CAF registered via expo-notifications `sounds` in app.json.
 * Used when the per-alarm AI CAF is missing or corrupt — never silent.
 */
export const FALLBACK_WAKE_SOUND = 'fs_fallback.caf';
const APP_GROUP = 'group.com.futureself.alarm';

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
    // Keep sounding even if the Silent switch is on / media was ducked.
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
  });
}

async function stopPlayback() {
  stopRingHaptics();
  if (!playback) return;
  try {
    playback.pause();
    playback.remove();
  } catch {
    // ignore
  }
  playback = null;
}

let ringingHaptic: ReturnType<typeof setInterval> | null = null;

function stopRingHaptics() {
  if (ringingHaptic) {
    clearInterval(ringingHaptic);
    ringingHaptic = null;
  }
}

async function pulseAlarmHaptics() {
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    /* optional */
  }
}

/** Play wake audio once (no loop). Optional vibrate pulses while it starts. */
export async function playAlarmAudio(
  uri: string,
  opts?: { vibrate?: boolean }
) {
  if (!uri || Platform.OS === 'web') return;
  await configureAudioForAlarm();
  await stopPlayback();
  stopRingHaptics();
  if (opts?.vibrate !== false) {
    void pulseAlarmHaptics();
    ringingHaptic = setInterval(() => {
      void pulseAlarmHaptics();
    }, 1400);
    setTimeout(stopRingHaptics, 8000);
  }
  const player = createAudioPlayer({ uri });
  player.loop = false;
  player.volume = 1;
  player.play();
  playback = player;
  // Keep volume pinned — user turning media down mid-wake shouldn't mute to 0.
  const pin = setInterval(() => {
    try {
      if (playback) playback.volume = 1;
    } catch {
      clearInterval(pin);
    }
  }, 400);
  setTimeout(() => clearInterval(pin), 45000);
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

type KitAction = 'dismiss' | 'snooze';

/** AlarmKit launch payload: which button was pressed + our alarm id. */
function kitPayload(action: KitAction, alarmId: string) {
  return `${action}:${alarmId}`;
}

function parseKitPayload(
  raw: unknown
): { action: KitAction | 'legacy'; alarmId: string } | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = /^(dismiss|snooze):(.+)$/.exec(raw);
  if (match) return { action: match[1] as KitAction, alarmId: match[2] };
  // Alarms scheduled before b76 carried the bare id.
  return { action: 'legacy', alarmId: raw };
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

/**
 * @param force — re-check after Settings (clears cached deny).
 * First call shows the system AlarmKit permission sheet.
 */
export async function ensureAlarmKitReady(force = false) {
  if (Platform.OS !== 'ios') {
    alarmKitReady = false;
    return false;
  }
  if (!force && alarmKitReady != null) return alarmKitReady;
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

/**
 * Soft check for nudges. Uses cache when set; when unknown, probes once
 * (requestAuthorization returns status without a second sheet after the first ask).
 */
export async function hasAlarmKitPermission() {
  if (Platform.OS !== 'ios') return false;
  if (alarmKitReady === true) return true;
  if (alarmKitReady === false) {
    // Re-probe after Settings — may flip to authorized without a new sheet.
    return ensureAlarmKitReady(true);
  }
  return false;
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
  vibrate?: boolean;
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
        vibrate: (params as { vibrate?: boolean }).vibrate !== false,
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

  const budget = notificationBudget();
  const times = nextAlarmOccurrences(alarm, budget.ahead);
  const sound = notificationSoundFor(alarm.id, hasSystemSound);
  const body = notificationBodyFor(alarm);
  const snoozeOn = alarm.snoozeEnabled !== false;
  const snoozeMin =
    typeof alarm.snoozeMinutes === 'number' && alarm.snoozeMinutes > 0
      ? alarm.snoozeMinutes
      : 10;
  const vibrateOn = alarm.vibrate !== false;

  // Main wakes in parallel. Snooze chain only when explicitly enabled.
  // Last pre-scheduled wake: ask the user to open the app so the window
  // refills — otherwise wakes silently stop after `budget.ahead` days.
  const lastIndex = times.length - 1;
  const jobs: Promise<unknown>[] = times.map((date, index) =>
    scheduleOneWakeNotification({
      identifier: notificationId(alarm.id, index),
      date,
      alarmId: alarm.id,
      body:
        index === lastIndex && times.length > 1
          ? 'Open Future Self today so your next alarms stay on.'
          : body,
      sound,
      audioUri,
      snoozeEnabled: snoozeOn,
      snoozeMinutes: snoozeMin,
      vibrate: vibrateOn,
      kind: 'wake',
    })
  );

  if (snoozeOn && times[0]) {
    const nextWake = times[0];
    for (let step = 1; step <= budget.snooze; step += 1) {
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
          vibrate: vibrateOn,
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
  // Always offer Later → 10 min. Notification path also pre-schedules +10/+20…
  const snoozeMin =
    typeof alarm.snoozeMinutes === 'number' && alarm.snoozeMinutes > 0
      ? alarm.snoozeMinutes
      : 10;
  const snoozeSec = Math.max(60, snoozeMin * 60);

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
        dismissPayload: kitPayload('dismiss', alarm.id),
        doSnoozeIntent: true,
        launchAppOnSnooze: true,
        snoozePayload: kitPayload('snooze', alarm.id),
        snoozeDuration: snoozeSec,
        tintColor: '#BADFFF',
        stopButtonLabel: "I'm up",
        snoozeButtonLabel: 'Snooze 10 min',
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
 * Wake path (iOS 26.1+):
 * 1) AlarmKit — real system alarm UI (I'm up / Later, Silent / Focus) with
 *    your voice CAF when Library/Sounds resolves.
 * 2) Else time-sensitive local notification + CAF (or bundled fallback).
 * Never schedule Kit *and* a wake notification together (double sound).
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

  // If MP3 exists but Library/Sounds CAF was wiped (migration / clear), rebuild it.
  const hasSystemSound = await ensureCustomWakeSound(alarm.id, audioUri);

  await cancelScheduledAlarm(alarm.id);

  // AlarmKit first = real system alarm UI (I'm up / Later). Custom voice CAF
  // must be Apple ima4 in Library/Sounds (see server mix). Notification only
  // if Kit unavailable / unauthorized.
  if (hasSystemSound) {
    const usedKit = await scheduleWithAlarmKit(alarm, true);
    if (usedKit) {
      // AlarmKit owns snooze and keeps ringing until Stop/Snooze. No
      // notification chain here: it doubled the +10 min ring and kept firing
      // after the system "I'm up".
      return { hasCustomVoice: true, mode: 'alarmkit' };
    }
  }

  // Notification path: play-once CAF + pre-scheduled +10/+20… until I’m up.
  await scheduleNotificationFallback(alarm, audioUri, hasSystemSound);
  return {
    hasCustomVoice: hasSystemSound,
    mode: 'notification',
  };
}

/** Ensure fs_alarm_*.caf exists when we still have the mixed MP3. */
async function ensureCustomWakeSound(
  alarmId: string,
  audioUri: string | null
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const fileName = alarmSoundFileName(alarmId);
  if (Platform.OS === 'ios') {
    if (await librarySoundExists(fileName)) return true;
  } else {
    const soundPath = alarmSoundPath(alarmId);
    if (soundPath) {
      const FileSystem = await import('expo-file-system/legacy');
      const info = await FileSystem.getInfoAsync(soundPath);
      if (info.exists) return true;
    }
  }
  if (!audioUri) return false;
  try {
    const { installAlarmSystemSound } = await import('./alarmSoundFile');
    await installAlarmSystemSound({ alarmId, mp3Uri: audioUri });
    if (Platform.OS === 'ios') {
      return librarySoundExists(fileName);
    }
    return true;
  } catch (error) {
    console.warn('Could not rebuild wake CAF', error);
    return false;
  }
}

/**
 * Real system (or notification) wake in N seconds — for “test / preview”.
 * Not in-app AV playback.
 */
export async function scheduleTestAlarmInSeconds(params: {
  alarmId: string;
  audioUri: string | null;
  seconds?: number;
}): Promise<'alarmkit' | 'notification'> {
  const seconds = Math.max(5, Math.min(params.seconds ?? 10, 120));
  if (Platform.OS === 'web') return 'notification';

  const fireAt = new Date(Date.now() + seconds * 1000);
  const hasSystemSound = await ensureCustomWakeSound(
    params.alarmId,
    params.audioUri
  );
  const soundName = hasSystemSound
    ? alarmSoundFileName(params.alarmId)
    : FALLBACK_WAKE_SOUND;

  const kit = await loadAlarmKit();
  if (kit) {
    const ready = await ensureAlarmKitReady();
    if (ready) {
      const id = alarmKitUUID(`test_${params.alarmId}`);
      try {
        await kit.cancelAlarm(id).catch(() => undefined);
        const ok = await kit.scheduleAlarm({
          id,
          date: fireAt,
          title: 'Future You',
          soundName,
          launchAppOnDismiss: true,
          dismissPayload: kitPayload('dismiss', params.alarmId),
          stopButtonLabel: "I'm up",
          snoozeButtonLabel: 'Snooze 10 min',
          tintColor: '#BADFFF',
          doSnoozeIntent: true,
          launchAppOnSnooze: true,
          snoozePayload: kitPayload('snooze', params.alarmId),
          snoozeDuration: 10 * 60,
        });
        if (ok) return 'alarmkit';
      } catch (error) {
        console.warn('AlarmKit test schedule failed', error);
      }
    }
  }

  const ok = await hasNotificationPermissions();
  if (!ok) {
    throw new Error(
      'Notifications are off. Allow alerts so Future Self can wake you.'
    );
  }
  await Notifications.cancelScheduledNotificationAsync(
    `fs_test_${params.alarmId}`
  ).catch(() => undefined);
  await scheduleOneWakeNotification({
    identifier: `fs_test_${params.alarmId}`,
    date: fireAt,
    alarmId: params.alarmId,
    body: 'Test wake: your morning voice.',
    sound: notificationSoundFor(params.alarmId, hasSystemSound),
    audioUri: params.audioUri,
    snoozeEnabled: false,
    snoozeMinutes: 10,
    kind: 'wake',
  });
  return 'notification';
}

async function handleAlarmNotification(
  notification: Notifications.Notification
) {
  const data = notification.request.content.data;
  if (!isFutureSelfAlarmData(data)) return;
  const uri = typeof data.audioUri === 'string' ? data.audioUri : null;
  const vibrate = (data as { vibrate?: boolean }).vibrate !== false;
  // Lock-screen / notification already played the CAF. Do NOT play the MP3
  // again — that felt like the same message repeating.
  await stopPlayback();
  if (vibrate) {
    void pulseAlarmHaptics();
  }
  emitRinging({ alarmId: data.alarmId, audioUri: uri });
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
 * Pause the current ring and fire again in `minutes` — does NOT disable the
 * recurring alarm or cancel tomorrow’s schedule.
 */
export async function snoozeRingingAlarm(
  alarmId: string,
  audioUri: string | null,
  minutes = 10
) {
  await stopPlayback();
  stopRingHaptics();
  if (Platform.OS !== 'web') {
    // Drop any pre-baked +10/+20 chain for this morning, then one clean snooze.
    await cancelNearTermSnoozes(alarmId);
    await Notifications.cancelScheduledNotificationAsync(
      `fs_test_snooze_${alarmId}`
    ).catch(() => undefined);
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
    await scheduleSnooze(alarmId, audioUri, minutes, true);
  }
  emitRinging(null);
}

/**
 * Stop in-app playback and cancel near-term system follow-ups.
 * Does NOT wipe the recurring AlarmKit / weekly schedule — only this morning’s
 * snooze chain and presented alerts.
 * Note: iOS cannot interrupt an already-playing UNNotificationSound mid-clip;
 * "I'm up" stops our AV player and prevents the next rings.
 */
export async function dismissAlarm(alarmId: string) {
  await stopPlayback();
  if (Platform.OS !== 'web') {
    await cancelNearTermSnoozes(alarmId);
    await Notifications.cancelScheduledNotificationAsync(
      snoozeId(alarmId)
    ).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(
      `fs_test_snooze_${alarmId}`
    ).catch(() => undefined);
    // Do not cancelAlarmKit here — that deleted the weekly schedule.
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
    const parsed = parseKitPayload(payload?.payload);
    if (!parsed) return;
    const { action, alarmId } = parsed;
    if (action === 'dismiss') {
      // System "I'm up" already stopped the alarm — just clear leftovers,
      // never show the ringing banner again.
      await dismissAlarm(alarmId);
      return;
    }
    // AlarmKit already played the wake CAF on the lock screen — no second play.
    await stopPlayback();
    if (action === 'snooze') {
      // Kit re-rings in snoozeDuration by itself.
      emitRinging(null);
      return;
    }
    const uri = audioByAlarmId[alarmId] ?? null;
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
  enabledAlarmCount = alarms.filter((a) => a.enabled).length;
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

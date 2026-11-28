import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { instantOn, upcomingZoneDays } from './timeZone';
import type { Alarm } from '../context/AlarmsContext';
import {
  alarmSoundFileName,
  alarmSoundPath,
} from './alarmSoundFile';
import { librarySoundExists } from '../../modules/ios-library-sounds/src';
import {
  BANK_SIZE,
  type RingMessage,
  currentRingMessage,
  isTemplateText,
  ringMessageAt,
  ringMessagesFor,
} from './ringBank';

/** Local copy — avoid require cycle with AlarmsContext. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const SCHEDULE_AHEAD = 7;
/** iOS keeps only the soonest 64 pending local notifications per app. */
const IOS_PENDING_LIMIT = 64;
/** Leave room for test wakes / one-off snoozes. */
const NOTIFICATION_HEADROOM = 12; // also evening nudges + "are you up?" checks
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

/** Stop an in-app replay of the wake message (wake screen "stop"). */
export async function stopAlarmPlayback() {
  await stopPlayback();
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

/** Snooze texts get firmer with each round, never guilt-tripping. */
function snoozeBody(step: number) {
  if (step <= 1) return 'Still here. Your voice again.';
  if (step === 2) return 'Second time. Remember what you promised yourself.';
  if (step === 3) return 'You deserve this morning. Feet on the floor, now.';
  return 'I’m not giving up on you. Sit up, I’ll wait.';
}

/** Play wake audio once (no loop). The app never vibrates for alarms. */
export async function playAlarmAudio(uri: string) {
  if (!uri || Platform.OS === 'web') return;
  await configureAudioForAlarm();
  await stopPlayback();
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
      enableVibrate: false,
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

/** AlarmKit launch payload: which button was pressed + our alarm id + ring. */
function kitPayload(action: KitAction, alarmId: string, ringMs?: number) {
  return ringMs ? `${action}:${alarmId}|${ringMs}` : `${action}:${alarmId}`;
}

function parseKitPayload(
  raw: unknown
): { action: KitAction | 'legacy'; alarmId: string; ringMs: number | null } | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = /^(dismiss|snooze):([^|]+)(?:\|(\d+))?$/.exec(raw);
  if (match) {
    return {
      action: match[1] as KitAction,
      alarmId: match[2],
      ringMs: match[3] ? Number(match[3]) : null,
    };
  }
  // Alarms scheduled before b76 carried the bare id.
  return { action: 'legacy', alarmId: raw, ringMs: null };
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

export function nextAlarmOccurrences(
  alarm: Alarm,
  count = SCHEDULE_AHEAD,
  windowDays = 28
) {
  const out: Date[] = [];
  const now = Date.now();
  const days = alarmDays(alarm);

  // Days in the phone's real current zone (see timeZone.ts): the JS engine's
  // own local time can be the zone the app was launched in, hours off.
  for (const day of upcomingZoneDays(windowDays + 1)) {
    if (out.length >= count) break;
    if (!days.includes(jsDayToAlarmDay(day.weekday))) continue;
    const fire = instantOn(day, alarm.hour, alarm.minute);
    if (fire <= now) continue;
    out.push(new Date(fire));
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
  // Unknown (fresh launch) or false: ask iOS. Once the person has decided,
  // requestAuthorization just returns the status without a sheet. It used
  // to answer "no" while unknown, so "One step left" showed on every launch
  // even with alarms allowed.
  return ensureAlarmKitReady(true);
}

/** One AlarmKit alarm per ring (each with its own sound); ids kept here. */
function kitIdsKey(alarmId: string) {
  return `fsa.alarmkit_ids.v1.${alarmId}`;
}

async function readKitIds(alarmId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(kitIdsKey(alarmId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function writeKitIds(alarmId: string, ids: string[]) {
  if (ids.length) {
    await AsyncStorage.setItem(kitIdsKey(alarmId), JSON.stringify(ids)).catch(
      () => {}
    );
  } else {
    await AsyncStorage.removeItem(kitIdsKey(alarmId)).catch(() => {});
  }
}

async function cancelAlarmKit(alarmId: string) {
  const kit = await loadAlarmKit();
  if (!kit) return;
  // Legacy single repeating alarm (before per-ring messages) + every ring.
  const ids = [alarmKitUUID(alarmId), ...(await readKitIds(alarmId))];
  await Promise.all(ids.map((id) => kit.cancelAlarm(id).catch(() => false)));
  await writeKitIds(alarmId, []);
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
  /** This ring's message, shown on the wake screen. */
  scriptText?: string | null;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  kind: 'wake' | 'snooze';
  /** 1 = first snooze, 2 = second… (the text gets firmer, never harsh). */
  snoozeStep?: number;
}) {
  await Notifications.scheduleNotificationAsync({
    identifier: params.identifier,
    content: {
      title: 'Future You',
      body:
        params.kind === 'snooze'
          ? snoozeBody(params.snoozeStep ?? 1)
          : params.body,
      sound: params.sound,
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      data: {
        type: 'future-self-alarm',
        alarmId: params.alarmId,
        audioUri: params.audioUri || undefined,
        scriptText: params.scriptText || undefined,
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

/** One upcoming ring: when, which sound, which message. */
type RingPlan = {
  date: Date;
  sound: string;
  audioUri: string | null;
  text: string | null;
  /** Plays the user's voice (not the bundled fallback tone). */
  custom: boolean;
};

async function wakeSoundExists(fileName: string) {
  if (Platform.OS === 'ios') return librarySoundExists(fileName);
  const root = alarmSoundPath('x')?.replace(/[^/]+$/, '');
  if (!root) return false;
  const FileSystem = await import('expo-file-system/legacy');
  const info = await FileSystem.getInfoAsync(`${root}${fileName}`);
  return info.exists;
}

/**
 * Each ring gets its own stocked message (ringBank). Rings past the stocked
 * week reuse the stocked messages in turn, so the words keep changing even if
 * the app is never opened. No stock → the alarm's base message / fallback tone.
 */
async function planRings(
  alarm: Alarm,
  baseAudioUri: string | null,
  hasBaseSound: boolean,
  count: number,
  windowDays = 28
): Promise<RingPlan[]> {
  const dates = nextAlarmOccurrences(alarm, count, windowDays);
  const now = Date.now();
  const stocked: RingMessage[] = [];
  // Earlier messages: replayed when nothing new could be built (voice/AI
  // service down or unpaid) so mornings still vary instead of the base text.
  const archive: RingMessage[] = [];
  for (const m of await ringMessagesFor(alarm.id)) {
    if (!(await wakeSoundExists(m.soundName))) continue;
    if (m.ring > now) stocked.push(m);
    // Never replay an old template message as a fallback.
    else if (!isTemplateText(m.text)) archive.push(m);
  }
  archive.sort((a, b) => b.ring - a.ring);
  // A base sound recorded from the old fixed template (built while the AI
  // was unavailable) must never play: fall back to the soft tone instead.
  const baseIsTemplate = isTemplateText(alarm.scriptText);
  const baseUsable = hasBaseSound && !baseIsTemplate;
  const baseSound = notificationSoundFor(alarm.id, baseUsable);
  return dates.map((date, index) => {
    const exact = stocked.find((m) => m.ring === date.getTime());
    const pool = stocked.length ? stocked : archive;
    const m = exact ?? (pool.length ? pool[index % pool.length] : null);
    if (m) {
      return {
        date,
        sound: Platform.OS === 'android' ? 'default' : m.soundName,
        audioUri: m.mp3Uri,
        text: m.text,
        custom: true,
      };
    }
    return {
      date,
      sound: baseSound,
      audioUri: baseIsTemplate ? null : baseAudioUri,
      text: baseIsTemplate ? null : alarm.scriptText ?? null,
      custom: baseUsable,
    };
  });
}

async function scheduleNotificationFallback(alarm: Alarm, plan: RingPlan[]) {
  // Silent path: never pop the permission sheet mid-session (looks like a hang).
  const ok = await hasNotificationPermissions();
  if (!ok) {
    throw new Error(
      'Notifications are off. Allow alerts so Future Self can wake you.'
    );
  }

  const budget = notificationBudget();
  const snoozeOn = alarm.snoozeEnabled !== false;
  const snoozeMin =
    typeof alarm.snoozeMinutes === 'number' && alarm.snoozeMinutes > 0
      ? alarm.snoozeMinutes
      : 10;

  // Main wakes in parallel. Snooze chain only when explicitly enabled.
  // Last pre-scheduled wake: ask the user to open the app so the window
  // refills — otherwise wakes silently stop after `budget.ahead` days.
  const lastIndex = plan.length - 1;
  const jobs: Promise<unknown>[] = plan.map((ring, index) =>
    scheduleOneWakeNotification({
      identifier: notificationId(alarm.id, index),
      date: ring.date,
      alarmId: alarm.id,
      body:
        index === lastIndex && plan.length > 1
          ? 'Open Future Self today so your next alarms stay on.'
          : notificationBodyFor(ring.text),
      sound: ring.sound,
      audioUri: ring.audioUri,
      scriptText: ring.text,
      snoozeEnabled: snoozeOn,
      snoozeMinutes: snoozeMin,
      kind: 'wake',
    })
  );

  const first = plan[0];
  if (snoozeOn && first) {
    for (let step = 1; step <= budget.snooze; step += 1) {
      const follow = new Date(
        first.date.getTime() + step * snoozeMin * 60 * 1000
      );
      jobs.push(
        scheduleOneWakeNotification({
          identifier: snoozeChainId(alarm.id, 0, step),
          date: follow,
          alarmId: alarm.id,
          body: notificationBodyFor(first.text),
          sound: first.sound,
          audioUri: first.audioUri,
          scriptText: first.text,
          snoozeEnabled: true,
          snoozeMinutes: snoozeMin,
          kind: 'snooze',
          snoozeStep: step,
        })
      );
    }
  }

  await Promise.all(jobs);
}

function notificationBodyFor(scriptText: string | null | undefined) {
  const script = String(scriptText || '').replace(/\s+/g, ' ').trim();
  if (script.length > 40) {
    return script.length > 160 ? `${script.slice(0, 157).trim()}…` : script;
  }
  return 'Your morning voice is ready. Open when you’re up.';
}

/** AlarmKit rings scheduled ahead: one-off alarms, 4 weeks. */
const KIT_AHEAD_DAYS = 28;

async function scheduleWithAlarmKit(
  alarm: Alarm,
  plan: RingPlan[]
): Promise<boolean> {
  // A wake is ALWAYS a real alarm (full screen, rings until "I'm up"), even
  // when the voice isn't ready: those rings use the bundled soft tone
  // (fs_fallback.caf). Skipping Kit here sent a plain notification instead,
  // which on a locked phone looked like a text message and didn't wake people.
  if (!plan.length) return false;

  const kit = await loadAlarmKit();
  if (!kit) return false;
  const ready = await ensureAlarmKitReady();
  if (!ready) return false;

  // Always offer Later → 10 min.
  const snoozeMin =
    typeof alarm.snoozeMinutes === 'number' && alarm.snoozeMinutes > 0
      ? alarm.snoozeMinutes
      : 10;
  const snoozeSec = Math.max(60, snoozeMin * 60);

  // One one-off alarm per ring instead of one weekly repeating alarm: a
  // repeating alarm has ONE sound, so every morning said the same words.
  const ids: string[] = [];
  try {
    for (const ring of plan) {
      const ringMs = ring.date.getTime();
      const id = alarmKitUUID(`${alarm.id}@${ringMs}`);
      const options = {
        id,
        date: ring.date,
        title: 'Future You',
        launchAppOnDismiss: true,
        dismissPayload: kitPayload('dismiss', alarm.id, ringMs),
        doSnoozeIntent: true,
        launchAppOnSnooze: true,
        snoozePayload: kitPayload('snooze', alarm.id, ringMs),
        snoozeDuration: snoozeSec,
        tintColor: '#BADFFF',
        stopButtonLabel: "I'm up",
        snoozeButtonLabel: 'Snooze 10 min',
      };
      await kit.cancelAlarm(id).catch(() => undefined);
      let ok = await kit.scheduleAlarm({ ...options, soundName: ring.sound });
      if (!ok && /\.caf$/i.test(ring.sound)) {
        ok = await kit.scheduleAlarm({
          ...options,
          soundName: ring.sound.replace(/\.caf$/i, ''),
        });
      }
      if (!ok) throw new Error('AlarmKit refused a ring');
      ids.push(id);
    }
  } catch (error) {
    // Enough rings for the stocked week are on — keep them; the rest are
    // added the next time the app is open.
    if (ids.length < Math.min(BANK_SIZE, plan.length)) {
      console.warn('AlarmKit schedule failed', error);
      await Promise.all(ids.map((id) => kit.cancelAlarm(id).catch(() => false)));
      return false;
    }
  }
  await writeKitIds(alarm.id, ids);
  return true;
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
/**
 * One schedule at a time per alarm: each ring is its own AlarmKit alarm and
 * the id list lives in storage, so two overlapping runs (foreground top-up +
 * message stocking) could otherwise lose ids and leave a stray extra ring.
 */
const scheduleChains = new Map<string, Promise<unknown>>();

export function scheduleAlarmNotifications(
  alarm: Alarm,
  audioUri: string | null
): Promise<ScheduleWakeResult> {
  const prev = scheduleChains.get(alarm.id) ?? Promise.resolve();
  const run = prev
    .catch(() => undefined)
    .then(() => scheduleAlarmNotificationsNow(alarm, audioUri));
  const tail = run.catch(() => undefined);
  scheduleChains.set(alarm.id, tail);
  void tail.then(() => {
    if (scheduleChains.get(alarm.id) === tail) scheduleChains.delete(alarm.id);
  });
  return run;
}

async function scheduleAlarmNotificationsNow(
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

  // AlarmKit first = real system alarm UI (I'm up / Later). Notification
  // only if Kit is unavailable / unauthorized.
  const kitPlan = await planRings(
    alarm,
    audioUri,
    hasSystemSound,
    KIT_AHEAD_DAYS,
    KIT_AHEAD_DAYS
  );
  if (await scheduleWithAlarmKit(alarm, kitPlan)) {
    // AlarmKit owns snooze and keeps ringing until Stop/Snooze. No
    // notification chain here: it doubled the +10 min ring and kept firing
    // after the system "I'm up".
    return { hasCustomVoice: kitPlan.some((p) => p.custom), mode: 'alarmkit' };
  }

  // Notification path: play-once CAF + pre-scheduled +10/+20… until I'm up.
  const plan = await planRings(
    alarm,
    audioUri,
    hasSystemSound,
    notificationBudget().ahead
  );
  await scheduleNotificationFallback(alarm, plan);
  return {
    hasCustomVoice: plan.some((p) => p.custom),
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
  const rawText = (data as { scriptText?: unknown }).scriptText;
  const scriptText = typeof rawText === 'string' ? rawText : null;
  // Lock-screen / notification already played the CAF. Do NOT play the MP3
  // again — that felt like the same message repeating.
  await stopPlayback();
  emitRinging({ alarmId: data.alarmId, audioUri: uri, scriptText });
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
  // Snooze repeats THIS morning's message, not the alarm's base one.
  const current = await currentRingMessage(alarmId);
  if (current && (await wakeSoundExists(current.soundName))) {
    await scheduleOneWakeNotification({
      identifier: snoozeId(alarmId),
      date: fire,
      alarmId,
      body: 'Still here. Your voice again.',
      sound: Platform.OS === 'android' ? 'default' : current.soundName,
      audioUri: current.mp3Uri,
      scriptText: current.text,
      snoozeEnabled: true,
      snoozeMinutes: minutes,
      kind: 'snooze',
    });
    return;
  }
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

type RingingState = {
  alarmId: string;
  audioUri: string | null;
  /** This ring's message (falls back to the alarm's base text when absent). */
  scriptText?: string | null;
} | null;
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
    const { action, alarmId, ringMs } = parsed;
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
    const message = ringMs ? await ringMessageAt(alarmId, ringMs) : null;
    if (message) {
      emitRinging({
        alarmId,
        audioUri: message.mp3Uri,
        scriptText: message.text,
      });
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

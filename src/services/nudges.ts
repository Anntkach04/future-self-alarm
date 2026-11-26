import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Alarm } from '../context/AlarmsContext';
import { hasNotificationPermissions, nextAlarmOccurrences } from './alarmScheduler';

/**
 * Gentle evening nudges, so nobody has to remember to open the app:
 * - Check-in: "How was today? Tell me, and I'll bring it to tomorrow's alarm."
 *   Only on evenings before a day that has an alarm, and not if they already
 *   wrote today.
 * - No alarm: "No alarm for tomorrow yet." Only when the next day has none,
 *   for at most NO_ALARM_DAYS evenings in a row (then we stop asking).
 * One nudge per evening at most. Never asks for notification permission.
 */
const PREFIX = 'fsa-nudge-';
const DAYS_AHEAD = 7;
const NO_ALARM_DAYS = 3;
const CHECKIN_HOUR = 20;
const CHECKIN_MINUTE = 30;
const NO_ALARM_HOUR = 21;
const NO_ALARM_MINUTE = 0;

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function at(base: Date, dayOffset: number, hour: number, minute: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function timeLabel(d: Date) {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function refreshNudges(params: {
  alarms: Alarm[];
  paused: boolean;
  checkedInToday: boolean;
  /** From the wake-struggle question; 'asleep' / 'snooze' get an "are you up?" check. */
  wakeStruggle?: string | null;
  /** Evening nudges on (setting). The are-you-up check follows wakeStruggle only. */
  eveningNudges?: boolean;
}) {
  if (Platform.OS === 'web') return;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
        )
    );
    if (params.paused || !(await hasNotificationPermissions())) return;

    await scheduleAreYouUp(params);
    if (params.eveningNudges === false) return;

    const now = new Date();
    const rings = params.alarms
      .filter((a) => a.enabled)
      .flatMap((a) => nextAlarmOccurrences(a, DAYS_AHEAD + 2));

    let noAlarmCount = 0;
    for (let day = 0; day < DAYS_AHEAD; day += 1) {
      const tomorrow = at(now, day + 1, 0, 0);
      const firstRing = rings
        .filter((r) => sameDay(r, tomorrow))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (firstRing) {
        if (day === 0 && params.checkedInToday) continue;
        const when = at(now, day, CHECKIN_HOUR, CHECKIN_MINUTE);
        if (when <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}checkin-${day}`,
          content: {
            title: 'How was today?',
            body: `Tell me, and I’ll bring it to your alarm at ${timeLabel(firstRing)}.`,
            data: { type: 'fsa-nudge', kind: 'checkin' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
      } else if (noAlarmCount < NO_ALARM_DAYS) {
        const when = at(now, day, NO_ALARM_HOUR, NO_ALARM_MINUTE);
        if (when <= now) continue;
        noAlarmCount += 1;
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}noalarm-${day}`,
          content: {
            title: 'No alarm for tomorrow yet',
            body: 'Want your future self to wake you? It takes a few seconds.',
            data: { type: 'fsa-nudge', kind: 'no-alarm' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
      }
    }
  } catch (error) {
    console.warn('Nudges not scheduled', error);
  }
}

/** Minutes after a ring to ask "are you up?". Opening the app before then cancels it. */
const ARE_YOU_UP_MINUTES = 5;
const ARE_YOU_UP_RINGS = 5;

/**
 * For people who switch the alarm off and drift back to sleep: one firm
 * nudge a few minutes after each ring. Opening the app counts as awake:
 * every foreground re-plans, and a ring that already went off is skipped.
 */
async function scheduleAreYouUp(params: { alarms: Alarm[]; wakeStruggle?: string | null }) {
  if (params.wakeStruggle !== 'asleep' && params.wakeStruggle !== 'snooze') return;
  const now = Date.now();
  const rings = params.alarms
    .filter((a) => a.enabled)
    .flatMap((a) => nextAlarmOccurrences(a, ARE_YOU_UP_RINGS))
    .filter((d) => d.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, ARE_YOU_UP_RINGS);
  for (const ring of rings) {
    const when = new Date(ring.getTime() + ARE_YOU_UP_MINUTES * 60_000);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}up-${ring.getTime()}`,
      content: {
        title: 'Are you up?',
        body: 'Open the app and show me. Remember what you promised yourself.',
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        data: { type: 'fsa-nudge', kind: 'are-you-up' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}

import { NativeModules, Platform } from 'react-native';

/**
 * The phone's real, current time zone, read from iOS.
 *
 * Why not just `new Date()`: the JS engine (Hermes) fixes the local time zone
 * when the app starts. If the app stays in memory through a trip, "14:15"
 * keeps meaning 14:15 in the old place. Alarms are scheduled as fixed
 * instants, so they rang hours off. Here every wall-clock time is turned into
 * an instant with the offset iOS reports for that very day.
 */

export type ZoneDay = {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
  /** 0 = Sunday … 6 = Saturday, like Date#getDay */
  weekday: number;
  /** Minutes east of UTC on that day (DST-aware). */
  offsetMin: number;
};

type ZoneInfo = { zone: string; days: ZoneDay[] };

const DAYS_AHEAD = 40;

const Native =
  Platform.OS === 'ios'
    ? (NativeModules.IosLibrarySounds as
        | { zoneInfo?: (days: number) => Promise<ZoneInfo> }
        | undefined)
    : undefined;

let cache: ZoneInfo | null = null;

/** Ask iOS for the current zone and the next days in it. Call on launch / foreground. */
export async function refreshTimeZone(): Promise<string> {
  try {
    if (Native?.zoneInfo) {
      const info = await Native.zoneInfo(DAYS_AHEAD);
      if (info?.zone && Array.isArray(info.days) && info.days.length) {
        cache = info;
        return info.zone;
      }
    }
  } catch {
    // fall back below
  }
  cache = null;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function currentZoneName(): string {
  return cache?.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Instant (epoch ms) of hour:minute on a zone day. */
export function instantOn(day: ZoneDay, hour: number, minute: number) {
  return Date.UTC(day.y, day.m - 1, day.d, hour, minute, 0, 0) - day.offsetMin * 60_000;
}

/**
 * Today and the following days in the phone's current zone. Falls back to the
 * JS engine's local calendar when iOS can't be asked (web, old build).
 */
export function upcomingZoneDays(count: number): ZoneDay[] {
  const now = Date.now();
  if (cache) {
    // Drop days that are already over (cache made yesterday, app left open).
    const days = cache.days.filter((day) => instantOn(day, 23, 59) + 60_000 > now);
    if (days.length) return days.slice(0, count);
  }
  const out: ZoneDay[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    d.setHours(12, 0, 0, 0);
    out.push({
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      d: d.getDate(),
      weekday: d.getDay(),
      offsetMin: -d.getTimezoneOffset(),
    });
  }
  return out;
}

/** Offset (minutes east of UTC) in force at an instant, from the zone table. */
export function offsetAt(ms: number): number {
  const days = cache?.days;
  if (days?.length) {
    for (const day of days) {
      const start = instantOn(day, 0, 0);
      if (ms >= start && ms < start + 86_400_000) return day.offsetMin;
    }
    return days[days.length - 1].offsetMin;
  }
  return -new Date(ms).getTimezoneOffset();
}

/**
 * Same wall-clock time in the current zone: a ring stored at 7:00 with the
 * old offset becomes 7:00 here.
 */
export function sameWallClockHere(ms: number, oldOffsetMin: number): number {
  const wall = new Date(ms + oldOffsetMin * 60_000); // read with UTC getters
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth() + 1;
  const d = wall.getUTCDate();
  const day =
    cache?.days.find((z) => z.y === y && z.m === m && z.d === d) ??
    ({ y, m, d, weekday: wall.getUTCDay(), offsetMin: offsetAt(ms) } as ZoneDay);
  return instantOn(day, wall.getUTCHours(), wall.getUTCMinutes());
}

/** Wall-clock parts of an instant in the phone's current zone. */
export function wallClock(ms: number) {
  const w = new Date(ms + offsetAt(ms) * 60_000);
  return {
    y: w.getUTCFullYear(),
    m: w.getUTCMonth() + 1,
    d: w.getUTCDate(),
    hour: w.getUTCHours(),
    minute: w.getUTCMinutes(),
    weekday: w.getUTCDay(),
  };
}

/** "7:05" in the phone's current zone. */
export function timeLabel(ms: number) {
  const w = wallClock(ms);
  return `${w.hour}:${String(w.minute).padStart(2, '0')}`;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { deleteWakeSound } from './alarmSoundFile';

/**
 * Ready-made wake messages, one per upcoming ring.
 *
 * iOS never lets the app run at a set time, so a message cannot be written
 * at the moment the alarm rings. Instead, whenever the app is open we keep
 * BANK_SIZE future rings stocked with their own text + voice + wake sound,
 * and each ring is scheduled as its own system alarm with its own sound.
 * The user does not need to open the app the evening before.
 */
export const BANK_SIZE = 7;
const KEY = 'fsa.ring_bank.v1';

export type RingMessage = {
  /** Ring time, epoch ms. */
  ring: number;
  text: string;
  /** Full MP3 for the in-app wake screen. */
  mp3Uri: string;
  /** Wake sound file in Library/Sounds (unique per build). */
  soundName: string;
  /** What the message depended on (mood, AI consent) — see eveningRegen. */
  prepKey: string;
  builds: number;
};

type Bank = Record<string, RingMessage[]>;

let queue: Promise<unknown> = Promise.resolve();

/** Serialize read-modify-write so parallel callers don't drop entries. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readBank(): Promise<Bank> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeBank(bank: Bank) {
  await AsyncStorage.setItem(KEY, JSON.stringify(bank)).catch(() => {});
}

export async function ringMessagesFor(alarmId: string): Promise<RingMessage[]> {
  const bank = await readBank();
  return [...(bank[alarmId] ?? [])].sort((a, b) => a.ring - b.ring);
}

/** Message for a ring time — exact ring only. */
export async function ringMessageAt(alarmId: string, ringMs: number) {
  const list = await ringMessagesFor(alarmId);
  return list.find((m) => m.ring === ringMs) ?? null;
}

/** The ring that just went off (for snooze / the wake screen). */
export async function currentRingMessage(alarmId: string, now = Date.now()) {
  const list = await ringMessagesFor(alarmId);
  const recent = list.filter(
    (m) => m.ring <= now + 60 * 1000 && m.ring >= now - 3 * 60 * 60 * 1000
  );
  return recent.length ? recent[recent.length - 1] : null;
}

/** Store (or replace) one ring's message. Returns the entry it replaced. */
export function putRingMessage(alarmId: string, message: RingMessage) {
  return locked(async () => {
    const bank = await readBank();
    const list = bank[alarmId] ?? [];
    const prev = list.find((m) => m.ring === message.ring) ?? null;
    bank[alarmId] = [...list.filter((m) => m.ring !== message.ring), message];
    await writeBank(bank);
    return prev;
  });
}

/**
 * Drop messages no longer needed: rings that are not upcoming any more
 * (time/days edited) and rings that went off over 12 h ago. Returns them so
 * the caller can delete files AFTER rescheduling away from them.
 */
export function pruneRingMessages(
  alarmId: string,
  upcomingRings: number[],
  now = Date.now()
) {
  return locked(async () => {
    const bank = await readBank();
    const list = bank[alarmId] ?? [];
    const upcoming = new Set(upcomingRings);
    const keep: RingMessage[] = [];
    const drop: RingMessage[] = [];
    for (const m of list) {
      const justRang = m.ring <= now && m.ring >= now - 12 * 60 * 60 * 1000;
      if (upcoming.has(m.ring) || justRang) keep.push(m);
      else drop.push(m);
    }
    if (keep.length) bank[alarmId] = keep;
    else delete bank[alarmId];
    await writeBank(bank);
    return drop;
  });
}

/** Alarm deleted / app reset: forget everything for these alarms. */
export function dropRingMessagesExcept(alarmIds: string[]) {
  return locked(async () => {
    const bank = await readBank();
    const drop: RingMessage[] = [];
    for (const id of Object.keys(bank)) {
      if (alarmIds.includes(id)) continue;
      drop.push(...bank[id]);
      delete bank[id];
    }
    await writeBank(bank);
    return drop;
  });
}

export async function deleteRingFiles(messages: RingMessage[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    messages.map(async (m) => {
      await deleteWakeSound(m.soundName);
      if (m.mp3Uri) {
        await FileSystem.deleteAsync(m.mp3Uri, { idempotent: true }).catch(
          () => undefined
        );
      }
    })
  );
}

export const RING_BANK_STORAGE_KEY = KEY;

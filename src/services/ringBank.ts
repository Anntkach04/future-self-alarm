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
  /** When it was written (newest-first history for the AI). */
  builtAt?: number;
  /** The plan the server chose, sent back so the next script varies. */
  scenario?: string | null;
  theme?: string | null;
  opening?: string | null;
};

export type RecentScript = {
  text: string;
  scenario?: string | null;
  theme?: string | null;
  opening?: string | null;
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
 * Past messages kept as a fallback. If the voice or AI service is down (or
 * unpaid), upcoming rings replay these instead of the one fixed base text.
 */
export const ARCHIVE_SIZE = 7;

/**
 * The old fixed template (removed). The server used it silently whenever
 * OpenAI failed (e.g. out of credits), so banks filled with it, even on
 * phones that onboarded recently. Such messages are rebuilt and never kept
 * as fallback.
 */
export function isTemplateText(text: string | null | undefined) {
  return /Feel the bed for a second, then sit up when you(?:'|’)re ready/i.test(text || '');
}

/**
 * Keep every upcoming ring plus the newest ARCHIVE_SIZE other messages
 * (rings that already went off, or rings dropped by a time/day edit).
 * Returns the rest so the caller can delete files AFTER rescheduling.
 */
export function pruneRingMessages(
  alarmId: string,
  upcomingRings: number[],
  _now = Date.now()
) {
  return locked(async () => {
    const bank = await readBank();
    const list = bank[alarmId] ?? [];
    const upcoming = new Set(upcomingRings);
    const keep: RingMessage[] = [];
    const rest: RingMessage[] = [];
    const drop: RingMessage[] = [];
    for (const m of list) {
      if (upcoming.has(m.ring)) keep.push(m);
      else if (isTemplateText(m.text)) drop.push(m);
      else rest.push(m);
    }
    rest.sort((a, b) => b.ring - a.ring);
    keep.push(...rest.slice(0, ARCHIVE_SIZE));
    drop.push(...rest.slice(ARCHIVE_SIZE));
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

/**
 * The person's last scripts across all alarms, newest first. The server
 * tells the model not to repeat their openings, phrases or structure.
 */
export async function recentScripts(limit = 10): Promise<RecentScript[]> {
  const bank = await readBank();
  return Object.values(bank)
    .flat()
    .filter((m) => m.text && !isTemplateText(m.text))
    .sort((a, b) => (b.builtAt ?? b.ring) - (a.builtAt ?? a.ring))
    .slice(0, limit)
    .map((m) => ({
      text: m.text,
      scenario: m.scenario ?? null,
      theme: m.theme ?? null,
      opening: m.opening ?? null,
    }));
}

export const RING_BANK_STORAGE_KEY = KEY;

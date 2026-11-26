import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Alarm } from '../context/AlarmsContext';
import type { OnboardingAnswers } from '../context/OnboardingContext';
import { installRingSound } from './alarmSoundFile';
import { nextAlarmOccurrences, scheduleAlarmNotifications } from './alarmScheduler';
import { saveAlarmAudio } from './audioPreview';
import { generateMorningAlarm } from './elevenlabs';
import {
  BANK_SIZE,
  deleteRingFiles,
  dropRingMessagesExcept,
  pruneRingMessages,
  isTemplateText,
  putRingMessage,
  recentScripts,
  ringMessagesFor,
  type RingMessage,
} from './ringBank';

/**
 * A different wake message for every ring, without the user having to open
 * the app the evening before:
 * - Whenever the app is open, the next BANK_SIZE rings of every alarm are
 *   stocked with their own text + voice (see ringBank.ts). Each ring is one
 *   generation; a stocked ring is never paid for twice unless something
 *   below changes.
 * - Today's mood shapes only the NEXT ring, and only inside its prepare
 *   window (PREPARE_WINDOW_HOURS before it). A mood logged there rebuilds
 *   that ring once (MAX_BUILDS_PER_RING).
 * - Agreeing to personal AI scripts rebuilds rings built from the template.
 * - Never touch a ring in the last MIN_LEAD_MINUTES before it.
 */
/**
 * A check-in counts for the next ring if that ring is within this many
 * hours. It used to be 10: a mood written at 20:00 for a 7:00 alarm was
 * outside it and, unless the app was opened again later, never used.
 */
export const PREPARE_WINDOW_HOURS = 24;
const MIN_LEAD_MINUTES = 10;
const MAX_BUILDS_PER_RING = 2;

export function moodKeyOf(mood: { label: string; note?: string; intention?: string | null; followUp?: string | null } | null) {
  return mood
    ? `${mood.label}|${mood.note ?? ''}|${mood.intention ?? ''}|${mood.followUp ?? ''}`
    : '';
}

/** What the built message depended on: mood (next ring only) + AI consent. */
async function prepKeyOf(
  mood: { label: string; note?: string; intention?: string | null; followUp?: string | null } | null,
  voiceId: string | null
) {
  const { hasAiConsent } = await import('./aiConsent');
  // Voice in the key: after a re-record, stocked rings are rebuilt in the
  // new voice instead of playing the old one for up to a week.
  return `${moodKeyOf(mood)}|ai:${(await hasAiConsent()) ? 1 : 0}|v:${voiceId ?? ''}`;
}

type Mood = { label: string; note?: string; intention?: string | null; followUp?: string | null } | null;

function ringMood(index: number, ringMs: number, mood: Mood, now: number) {
  const inWindow = ringMs - now <= PREPARE_WINDOW_HOURS * 60 * 60 * 1000;
  return index === 0 && inWindow ? mood : null;
}

/** Text + voice + wake sound for one ring. */
async function buildRingMessage(params: {
  alarmId: string;
  ringMs: number;
  voiceId: string;
  answers: OnboardingAnswers;
  mood: Mood;
  prepKey: string;
  builds: number;
}): Promise<RingMessage> {
  const generated = await generateMorningAlarm({
    voiceId: params.voiceId,
    answers: params.answers,
    mood: params.mood ?? undefined,
    forDate: new Date(params.ringMs),
    // Includes rings stocked a moment ago in this same run.
    recentScripts: await recentScripts(10),
  });
  const mp3Uri = await saveAlarmAudio(
    generated.base64,
    `${params.alarmId}__ring_${params.ringMs}_${Date.now().toString(36)}`
  );
  try {
    const soundName = await installRingSound({
      alarmId: params.alarmId,
      ringMs: params.ringMs,
      mp3Uri,
    });
    return {
      ring: params.ringMs,
      text: generated.text,
      mp3Uri,
      soundName,
      prepKey: params.prepKey,
      builds: params.builds,
      builtAt: Date.now(),
      scenario: generated.scenario ?? null,
      theme: generated.theme ?? null,
      opening: generated.opening ?? null,
    };
  } catch (error) {
    await FileSystem.deleteAsync(mp3Uri, { idempotent: true }).catch(
      () => undefined
    );
    throw error;
  }
}

/**
 * The message just built on Create/Edit counts as the next ring's message,
 * so stocking does not pay for that ring again. Needs only a sound
 * conversion, no new voice generation.
 */
export async function adoptMessageForNextRing(
  alarm: Alarm,
  built: { mp3Uri: string; text: string },
  mood: Mood,
  voiceId: string | null
) {
  if (Platform.OS === 'web') return;
  const next = nextAlarmOccurrences(alarm, 1)[0];
  if (!next) return;
  const ringMs = next.getTime();
  const now = Date.now();
  if (ringMs - now < MIN_LEAD_MINUTES * 60 * 1000) return;
  try {
    const mp3Uri = built.mp3Uri.replace(
      /\.mp3$/i,
      `__ring_${ringMs}_${now.toString(36)}.mp3`
    );
    await FileSystem.copyAsync({ from: built.mp3Uri, to: mp3Uri });
    const soundName = await installRingSound({
      alarmId: alarm.id,
      ringMs,
      mp3Uri,
    });
    const prev = await putRingMessage(alarm.id, {
      ring: ringMs,
      text: built.text,
      mp3Uri,
      soundName,
      prepKey: await prepKeyOf(ringMood(0, ringMs, mood, now), voiceId ?? null),
      builds: 1,
      builtAt: now,
    });
    if (prev) await deleteRingFiles([prev]);
  } catch (error) {
    console.warn('Could not stock the new alarm message', error);
  }
}

/** Server said stop (quota, billing, rate limit) — don't hammer it. */
function isHardStop(error: unknown) {
  const msg = String((error as Error)?.message || error).toLowerCase();
  return /429|too many|quota|billing|payment|402|subscription|entitle/.test(msg);
}

export async function maybeEveningRegen(params: {
  alarms: Alarm[];
  voiceId: string | null;
  answers: OnboardingAnswers;
  mood: Mood;
  paused?: boolean;
  updateAlarm?: (id: string, patch: Partial<Alarm>) => void;
}) {
  const { alarms, voiceId, answers, mood, paused } = params;
  if (Platform.OS === 'web' || paused || !voiceId) return;

  // Deleted alarms: forget their messages.
  await deleteRingFiles(await dropRingMessagesExcept(alarms.map((a) => a.id)));

  let stopAll = false;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const now = Date.now();
    const upcoming = nextAlarmOccurrences(alarm, BANK_SIZE).map((d) =>
      d.getTime()
    );
    const replaced: RingMessage[] = [];
    let changed = false;

    for (let index = 0; index < upcoming.length && !stopAll; index += 1) {
      const ringMs = upcoming[index];
      if (ringMs - Date.now() < MIN_LEAD_MINUTES * 60 * 1000) continue;
      const stocked = (await ringMessagesFor(alarm.id)).find(
        (m) => m.ring === ringMs
      );
      const ringMoodNow = ringMood(index, ringMs, mood, now);
      const prepKey = await prepKeyOf(ringMoodNow, voiceId);
      const needsBuild =
        !stocked ||
        // Template text from an AI outage: always replace with a real one.
        isTemplateText(stocked.text) ||
        (stocked.prepKey !== prepKey && stocked.builds < MAX_BUILDS_PER_RING);
      if (!needsBuild) continue;

      try {
        const message = await buildRingMessage({
          alarmId: alarm.id,
          ringMs,
          voiceId,
          answers,
          mood: ringMoodNow,
          prepKey,
          builds: (stocked?.builds ?? 0) + 1,
        });
        const prev = await putRingMessage(alarm.id, message);
        if (prev) replaced.push(prev);
        changed = true;
      } catch (error) {
        // The ring keeps whatever it already has (stocked message, or the
        // other stocked messages in turn, or the base message).
        console.warn('Wake message build failed', error);
        if (isHardStop(error)) stopAll = true;
        break;
      }
    }

    const dropped = await pruneRingMessages(alarm.id, upcoming);
    let rescheduled = true;
    if (changed || dropped.length) {
      try {
        await scheduleAlarmNotifications(alarm, alarm.audioUri ?? null);
      } catch (error) {
        rescheduled = false;
        console.warn('Reschedule after stocking failed', error);
      }
    }
    // Only once nothing scheduled points at them any more.
    if (rescheduled) await deleteRingFiles([...replaced, ...dropped]);
    if (stopAll) break;
  }
}

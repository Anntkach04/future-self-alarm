import { ensureAiConsent } from './aiConsent';
import { authHeaders } from './apiAuth';
import { getApiUrl } from './elevenlabs';
import { CRISIS_REPLY, looksLikeCrisis } from './moodSafety';

const FALLBACK =
  'Thank you for telling me. You showed up for yourself today, and that counts. Sleep well, I will be there in the morning.';

export type MoodAdviceResult = {
  text: string;
  fromAi: boolean;
  /** One thing they want to do tomorrow, if they said so ("finish the deck"). */
  intention?: string | null;
  /** A longer-term goal they mentioned that is not on their list yet. */
  newGoal?: string | null;
};

export async function fetchMoodAdvice(input: {
  mood: string;
  note: string;
  name: string;
  /** Onboarding goals and wished-for morning feelings: make the reply personal. */
  goals?: string[];
  feelings?: string[];
}): Promise<MoodAdviceResult> {
  if (looksLikeCrisis(`${input.mood} ${input.note}`)) {
    return { text: CRISIS_REPLY, fromAi: false };
  }
  // Mood notes go to OpenAI only with consent (App Review 5.1.2).
  if (!(await ensureAiConsent())) {
    return { text: FALLBACK, fromAi: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${getApiUrl()}/api/mood-advice`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = (await response.json()) as {
      advice?: string;
      error?: string;
      intention?: string | null;
      newGoal?: string | null;
    };
    if (!response.ok || !data.advice) {
      return { text: FALLBACK, fromAi: false };
    }
    return {
      text: data.advice.trim(),
      fromAi: true,
      intention: data.intention || null,
      newGoal: data.newGoal || null,
    };
  } catch {
    return { text: FALLBACK, fromAi: false };
  } finally {
    clearTimeout(timer);
  }
}

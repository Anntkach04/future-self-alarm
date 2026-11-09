import { ensureAiConsent } from './aiConsent';
import { authHeaders } from './apiAuth';
import { getApiUrl } from './elevenlabs';

const FALLBACK =
  "That’s not the real you. You’re strong, capable, and already winning. Rest up; tomorrow you’re going to crush it.";

export type MoodAdviceResult = {
  text: string;
  fromAi: boolean;
};

export async function fetchMoodAdvice(input: {
  mood: string;
  note: string;
  name: string;
}): Promise<MoodAdviceResult> {
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
    const data = (await response.json()) as { advice?: string; error?: string };
    if (!response.ok || !data.advice) {
      return { text: FALLBACK, fromAi: false };
    }
    return { text: data.advice.trim(), fromAi: true };
  } catch {
    return { text: FALLBACK, fromAi: false };
  } finally {
    clearTimeout(timer);
  }
}

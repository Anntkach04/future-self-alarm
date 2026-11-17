import { ensureAiConsent } from './aiConsent';
import { authHeaders } from './apiAuth';
import { getApiUrl } from './elevenlabs';
import { CRISIS_REPLY, looksLikeCrisis } from './moodSafety';

const FALLBACK =
  'Thank you for telling me. Rest tonight. Tomorrow starts fresh, and I will be there when you wake up.';

export type MoodAdviceResult = {
  text: string;
  fromAi: boolean;
};

export async function fetchMoodAdvice(input: {
  mood: string;
  note: string;
  name: string;
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

import { getApiUrl } from './elevenlabs';

const FALLBACK =
  "That's allowed. You don't have to sort the whole day tonight. Tomorrow, start with one small thing — I'll be there when you wake.";

export type MoodAdviceResult = {
  text: string;
  fromAi: boolean;
};

export async function fetchMoodAdvice(input: {
  mood: string;
  note: string;
  name: string;
}): Promise<MoodAdviceResult> {
  try {
    const response = await fetch(`${getApiUrl()}/api/mood-advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as { advice?: string; error?: string };
    if (!response.ok || !data.advice) {
      return { text: FALLBACK, fromAi: false };
    }
    return { text: data.advice.trim(), fromAi: true };
  } catch {
    return { text: FALLBACK, fromAi: false };
  }
}

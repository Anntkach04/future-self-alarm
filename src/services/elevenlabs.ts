const DEFAULT_API_URL = 'http://localhost:8787';

/** Built-in ElevenLabs voice (Rachel) for demo without Instant Voice Cloning. */
export const DEMO_VOICE = {
  id: '21m00Tcm4TlvDq8ikWAM',
  name: 'Rachel',
  label: 'Demo voice (Rachel)',
} as const;

export function getApiUrl() {
  return (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
}

export type CloneVoiceResult = {
  voiceId: string;
  requiresVerification?: boolean;
};

export type TtsResult = {
  mimeType: string;
  base64: string;
};

export type VoiceApiHealth = {
  ok: boolean;
  hasKey: boolean;
  elevenLabs?: boolean;
  openai?: boolean;
  musicBed?: boolean;
  ffmpeg?: boolean;
  readyToGenerate?: boolean;
};

export type GeneratedAlarm = {
  text: string;
  wordCount: number;
  model?: string;
  mimeType: string;
  base64: string;
  mixed: boolean;
  bedFile: string | null;
};

async function readError(response: Response) {
  try {
    const data = await response.json();
    const raw = JSON.stringify(data);
    if (typeof data?.error === 'string') {
      return `${data.error} ${raw}`;
    }
    if (typeof data?.details === 'string') return data.details;
    if (data?.details?.message) {
      return `${data.details.message} ${raw}`;
    }
    if (Array.isArray(data?.details?.detail)) {
      const first = data.details.detail[0];
      if (first?.message) return `${first.message} ${raw}`;
    }
    return raw;
  } catch {
    return response.statusText || 'Request failed';
  }
}

export async function checkVoiceApiHealth() {
  const response = await fetch(`${getApiUrl()}/api/health`);
  if (!response.ok) {
    throw new Error('Voice API is not reachable. Run npm run server.');
  }
  return response.json() as Promise<VoiceApiHealth>;
}

export async function cloneVoiceFromUri(params: {
  uri: string;
  name: string;
  mimeType?: string;
  fileName?: string;
}): Promise<CloneVoiceResult> {
  const form = new FormData();
  form.append('name', `${params.name || 'User'} Future Self`);

  const mimeType = params.mimeType || 'audio/m4a';
  const fileName = params.fileName || 'sample.m4a';

  // React Native FormData file shape; on web we convert URI → Blob.
  if (typeof window !== 'undefined' && params.uri.startsWith('blob:')) {
    const blob = await fetch(params.uri).then((r) => r.blob());
    form.append('file', blob, fileName);
  } else {
    form.append('file', {
      uri: params.uri,
      type: mimeType,
      name: fileName,
    } as unknown as Blob);
  }

  const response = await fetch(`${getApiUrl()}/api/voices/clone`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as CloneVoiceResult;
  if (!data.voiceId) {
    throw new Error('Clone succeeded but no voiceId returned');
  }
  return data;
}

export async function synthesizeSpeech(params: {
  voiceId: string;
  text: string;
}): Promise<TtsResult> {
  const response = await fetch(`${getApiUrl()}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voiceId: params.voiceId,
      text: params.text,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<TtsResult>;
}

export async function generateMorningAlarm(params: {
  voiceId: string;
  answers: {
    name: string;
    morningFeelings: string[];
    futureSelf: string[];
    alreadyProud: string[];
    hardMornings: string[];
    voiceStyle: string | null;
    messageLength: string | null;
    musicBedId?: string;
  };
}): Promise<GeneratedAlarm> {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const response = await fetch(`${getApiUrl()}/api/alarm/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voiceId: params.voiceId,
      answers: { ...params.answers, weekday },
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<GeneratedAlarm>;
}

export function isPaidPlanCloneError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('paid_plan_required') ||
    lower.includes('instant voice cloning') ||
    lower.includes('payment_required') ||
    lower.includes('can_not_use_instant_voice_cloning')
  );
}

export function buildPreviewLine(name: string) {
  const who = name.trim() || 'friend';
  return `Good morning, ${who}. This is you from the future. Get up — today matters. Start with one clear step.`;
}

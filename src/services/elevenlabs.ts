import { NativeModules, Platform } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:8787';
const API_PORT = 8787;

function lanHostFromMetro() {
  if (Platform.OS === 'web') return null;
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return null;
  const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
  const host = match?.[1];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

function normalizeBase(raw?: string | null) {
  if (!raw) return null;
  let url = raw.trim().replace(/\/$/, '');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  if (!url.includes('://')) return null;
  if (Platform.OS !== 'web' && /localhost|127\.0\.0\.1/.test(url)) return null;
  return url;
}

function candidateBases() {
  const bases: string[] = [];
  const add = (raw?: string | null) => {
    const url = normalizeBase(raw);
    if (url && !bases.includes(url)) bases.push(url);
  };
  add(cachedBase);
  add(process.env.EXPO_PUBLIC_API_URL);
  for (const part of (process.env.EXPO_PUBLIC_API_FALLBACKS || '').split(',')) {
    add(part);
  }
  const bonjour = (process.env.EXPO_PUBLIC_API_BONJOUR || '').trim();
  if (bonjour) {
    add(bonjour.includes('://') ? bonjour : `http://${bonjour}:${API_PORT}`);
  }
  const metro = lanHostFromMetro();
  if (metro) add(`http://${metro}:${API_PORT}`);
  return bases;
}

let cachedBase: string | null = null;
let resolveInFlight: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Do not AbortController-cancel in-flight iOS fetches. Expo's native fetch maps
 * abort() to FetchRequestCanceledException, which we were surfacing as "cannot
 * reach the voice server" even when the Mac already answered.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, init),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timeout after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchRetry(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  attempts = 3
) {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (error) {
      last = error;
      if (i < attempts - 1) await sleep(400 * (i + 1));
    }
  }
  throw last;
}

async function probeHealth(base: string, timeoutMs: number) {
  try {
    const response = await fetchWithTimeout(`${base}/api/health`, undefined, timeoutMs);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveApiUrl() {
  if (cachedBase && (await probeHealth(cachedBase, 4000))) {
    return cachedBase;
  }
  cachedBase = null;
  const bases = candidateBases();
  if (!bases.length) {
    throw connectError(new Error('No voice-server URL configured'));
  }

  const winner = await new Promise<string | null>((resolve) => {
    let settled = false;
    let pending = bases.length;
    const finish = (base: string | null) => {
      if (settled) return;
      settled = true;
      resolve(base);
    };
    for (const base of bases) {
      void probeHealth(base, 8000).then((ok) => {
        if (ok) finish(base);
        else if (--pending <= 0) finish(null);
      });
    }
  });

  if (!winner) {
    throw connectError(
      new Error(`tried ${bases.map((base) => `${base}/api/health`).join(', ')}`),
      bases[0]
    );
  }
  cachedBase = winner;
  return winner;
}

/** Built-in ElevenLabs voice (Rachel) for demo without Instant Voice Cloning. */
export const DEMO_VOICE = {
  id: '21m00Tcm4TlvDq8ikWAM',
  name: 'Rachel',
  label: 'Demo voice (Rachel)',
} as const;

export function getApiUrl() {
  if (cachedBase) return cachedBase;
  return candidateBases()[0] || DEFAULT_API_URL;
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

function connectError(cause?: unknown, atBase?: string | null) {
  const reason = cause instanceof Error ? cause.message : '';
  const shown = atBase || getApiUrl();
  return new Error(
    `Cannot reach the voice server at ${shown}. On the Mac run npm run server. Same Wi‑Fi. On iPhone: Settings → Privacy → Local Network → Future Self Alarm → ON. Safari test: ${shown}/api/health${reason ? ` (${reason})` : ''}`
  );
}

async function apiFetch(path: string, init?: RequestInit, timeoutMs = 25000) {
  if (!resolveInFlight) {
    resolveInFlight = resolveApiUrl().finally(() => {
      resolveInFlight = null;
    });
  }
  const base = await resolveInFlight;
  const url = `${base}${path}`;
  try {
    return await fetchRetry(url, init, timeoutMs, path.includes('/api/health') ? 3 : 2);
  } catch (error) {
    const failedBase = cachedBase || base;
    cachedBase = null;
    throw connectError(error, failedBase);
  }
}

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
  const response = await apiFetch('/api/health', undefined, 20000);
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
  const mimeType = params.mimeType || 'audio/m4a';
  const fileName = params.fileName || 'sample.m4a';
  const name = `${params.name || 'User'} Future Self`;

  // Web blob path
  if (typeof window !== 'undefined' && params.uri.startsWith('blob:')) {
    const blob = await fetch(params.uri).then((r) => r.blob());
    const form = new FormData();
    form.append('name', name);
    form.append('file', blob, fileName);
    const response = await apiFetch('/api/voices/clone', {
      method: 'POST',
      body: form,
    }, 180000);
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as CloneVoiceResult;
    if (!data.voiceId) throw new Error('Clone succeeded but no voiceId returned');
    return data;
  }

  // Native: send base64 JSON — FormData file parts break on newer RN ("Unsupported FormDataPart").
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(params.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await apiFetch(
    '/api/voices/clone-json',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, base64, mimeType, fileName }),
    },
    180000
  );

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
  const response = await apiFetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voiceId: params.voiceId,
      text: params.text,
    }),
  }, 120000);

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
  /** When set, server speaks this text instead of generating a new script. */
  text?: string;
}): Promise<GeneratedAlarm> {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const response = await apiFetch('/api/alarm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voiceId: params.voiceId,
      answers: { ...params.answers, weekday },
      ...(params.text ? { text: params.text } : {}),
    }),
  }, 180000);

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
  return `Good morning, ${who}. This is you from the future. Get up - today matters. Start with one clear step.`;
}

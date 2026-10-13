import Constants from 'expo-constants';
import { getApiUrl } from './elevenlabs';

export type AppVersionStatus = {
  updateAvailable: boolean;
  forced: boolean;
  currentVersion: string;
  minAppVersion: string | null;
  storeUrl: string | null;
};

function parseParts(v: string): number[] {
  return v
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
}

/** Compare semver-ish strings. Returns negative if a < b. */
export function compareVersions(a: string, b: string): number {
  const aa = parseParts(a);
  const bb = parseParts(b);
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i += 1) {
    const x = aa[i] || 0;
    const y = bb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function currentAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0'
  );
}

export async function checkAppVersionStatus(): Promise<AppVersionStatus> {
  const currentVersion = currentAppVersion();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${getApiUrl()}/api/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        updateAvailable: false,
        forced: false,
        currentVersion,
        minAppVersion: null,
        storeUrl: null,
      };
    }
    const data = (await response.json()) as {
      minAppVersion?: string;
      forceAppVersion?: string;
      storeUrl?: string;
    };
    const minAppVersion = data.minAppVersion?.trim() || null;
    const forceAppVersion = data.forceAppVersion?.trim() || null;
    const storeUrl = data.storeUrl?.trim() || null;

    const belowMin =
      Boolean(minAppVersion) &&
      compareVersions(currentVersion, minAppVersion!) < 0;
    const belowForce =
      Boolean(forceAppVersion) &&
      compareVersions(currentVersion, forceAppVersion!) < 0;

    return {
      updateAvailable: belowMin || belowForce,
      forced: belowForce,
      currentVersion,
      minAppVersion: minAppVersion || forceAppVersion,
      storeUrl,
    };
  } catch {
    return {
      updateAvailable: false,
      forced: false,
      currentVersion,
      minAppVersion: null,
      storeUrl: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

import { Platform } from 'react-native';
import { IOS_BUILD_NUMBER } from '../config/build';
import { currentAppVersion } from './appVersion';
import { getApiUrl } from './elevenlabs';

/**
 * Minimal crash/JS-error reporting → POST /api/client-error → Railway logs.
 * No third-party SDK, no personal data (message + stack + version only).
 * Native crashes are not captured — use Xcode Organizer / TestFlight for those.
 */

let installed = false;
let sentThisSession = 0;
const MAX_PER_SESSION = 10;

export function reportError(error: unknown, context: string, fatal = false) {
  if (__DEV__) return;
  if (sentThisSession >= MAX_PER_SESSION) return;
  sentThisSession += 1;
  const err = error instanceof Error ? error : new Error(String(error));
  void fetch(`${getApiUrl()}/api/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: String(err.message || 'Unknown error').slice(0, 500),
      stack: String(err.stack || '').slice(0, 4000),
      context: context.slice(0, 80),
      fatal,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appVersion: safeAppVersion(),
      build: IOS_BUILD_NUMBER,
    }),
  }).catch(() => undefined);
}

function safeAppVersion() {
  try {
    return currentAppVersion();
  } catch {
    return 'unknown';
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

/** Capture uncaught JS errors (then defer to React Native's own handler). */
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;
  const utils = (globalThis as {
    ErrorUtils?: {
      getGlobalHandler: () => GlobalHandler;
      setGlobalHandler: (handler: GlobalHandler) => void;
    };
  }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportError(error, 'global', Boolean(isFatal));
    previous?.(error, isFatal);
  });
}

/**
 * Remount-proof splash timing.
 * IntroCarouselScreen remounts were clearing useEffect setTimeouts, so the
 * welcome spinner (native-driven) could spin forever while JS timers reset.
 */

type Listener = () => void;

let finished = false;
let armedAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const HOLD_MS = 1000;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

function markFinished() {
  if (finished) return;
  finished = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  notify();
}

export function isIntroSplashFinished() {
  if (finished) return true;
  if (armedAt > 0 && Date.now() - armedAt >= HOLD_MS) {
    markFinished();
    return true;
  }
  return false;
}

export function armIntroSplash() {
  if (finished) {
    notify();
    return;
  }
  if (!armedAt) armedAt = Date.now();
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    markFinished();
  }, HOLD_MS);
}

export function subscribeIntroSplash(listener: Listener) {
  listeners.add(listener);
  if (isIntroSplashFinished()) listener();
  return () => {
    listeners.delete(listener);
  };
}

/** Welcome already played — Intro must not show a second blue splash. */
export function markIntroSplashFinished() {
  markFinished();
}

/** Test / reset only — call on each cold start before Welcome if needed. */
export function resetIntroSplashGate() {
  if (timer) clearTimeout(timer);
  timer = null;
  finished = false;
  armedAt = 0;
}

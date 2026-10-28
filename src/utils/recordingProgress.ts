/** Fill ratio and countdown for the voice-clone recording bar. */

export function recordingProgress(elapsedMs: number, targetSeconds: number) {
  const target =
    Number.isFinite(targetSeconds) && targetSeconds > 0 ? targetSeconds : 1;
  const targetMs = target * 1000;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const ratio = Math.min(1, elapsed / targetMs);
  const remainingMs = Math.max(0, targetMs - elapsed);
  return {
    ratio,
    remainingMs,
    done: elapsed >= targetMs,
    elapsedSeconds: Math.min(target, Math.floor(elapsed / 1000)),
    targetSeconds: target,
  };
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function recordingProgressLabel(options: {
  remainingMs: number;
  done: boolean;
  paused: boolean;
}) {
  if (options.done) return 'Enough audio';
  const clock = `${formatClock(options.remainingMs)} left`;
  if (options.paused) return `Paused · ${clock}`;
  return clock;
}

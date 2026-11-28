/**
 * Hands a check-in typed somewhere else (a reply to the evening
 * notification) to the Home check-in, which shows Future You's answer in the
 * usual sheet and saves it like any other check-in.
 */
type Listener = (words: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function deliverCheckIn(words: string) {
  const text = words.trim();
  if (!text) return;
  if (listeners.size) listeners.forEach((l) => l(text));
  else pending = text; // Home not mounted yet (cold start): keep it
}

export function onCheckIn(listener: Listener) {
  listeners.add(listener);
  if (pending) {
    const text = pending;
    pending = null;
    listener(text);
  }
  return () => {
    listeners.delete(listener);
  };
}

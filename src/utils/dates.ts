/** "2026-11-10" (local date key) → "Tue, Nov 10" in the user's locale. */
export function formatDateKey(key: string | null | undefined): string {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

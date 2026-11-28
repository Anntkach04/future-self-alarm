import { ReactNode, useEffect, useState } from 'react';

/** Don't run heavy hosts during the first paint / welcome. */
export function DeferredMount({
  children,
  delayMs = 4000,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!ready) return null;
  return <>{children}</>;
}

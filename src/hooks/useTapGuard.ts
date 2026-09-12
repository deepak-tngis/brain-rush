import { useCallback, useEffect, useRef } from 'react';

/**
 * Swallows repeat taps that arrive within `windowMs`.
 *
 * Android's touch handling happily delivers two presses from one enthusiastic
 * double-tap, which on this game would answer a puzzle and then immediately
 * answer the next one. Guarding at the source is more reliable than trying to
 * make every screen idempotent.
 */
export function useTapGuard(windowMs = 450): (action: () => void) => void {
  const lastTap = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(
    (action: () => void) => {
      const now = Date.now();
      if (now - lastTap.current < windowMs) return;
      lastTap.current = now;
      if (mounted.current) action();
    },
    [windowMs],
  );
}

/**
 * Guard for actions that take time (showing an ad, navigating away): stays
 * closed until the action's promise settles, however long that takes.
 */
export function useAsyncGuard(): {
  run(action: () => Promise<void> | void): void;
  busy: () => boolean;
} {
  const busy = useRef(false);

  const run = useCallback((action: () => Promise<void> | void) => {
    if (busy.current) return;
    busy.current = true;
    void Promise.resolve()
      .then(action)
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
  }, []);

  return { run, busy: () => busy.current };
}

import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

export interface CountdownOptions {
  readonly durationMs: number;
  /** Pausing stops the clock without losing the time already spent. */
  readonly running: boolean;
  /** Changing this restarts the clock from zero. */
  readonly resetKey: string | number;
  onExpire(): void;
}

export interface Countdown {
  readonly remainingMs: number;
  /** Milliseconds of *unpaused* time spent so far; used for the speed bonus. */
  elapsed(): number;
}

/**
 * The per-puzzle clock.
 *
 * Time is measured against wall-clock timestamps rather than accumulated from
 * tick counts, so a dropped frame or a busy thread cannot hand the player extra
 * seconds. Pausing (for a rewarded ad, or when the app is backgrounded) freezes
 * the clock rather than letting it run down out of sight.
 */
export function useCountdown({
  durationMs,
  running,
  resetKey,
  onExpire,
}: CountdownOptions): Countdown {
  const [remainingMs, setRemainingMs] = useState(durationMs);

  const startedAt = useRef(Date.now());
  const pausedSince = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const expired = useRef(false);
  const expireCallback = useRef(onExpire);
  expireCallback.current = onExpire;

  const elapsed = useCallback((): number => {
    const pausedNow = pausedSince.current === null ? 0 : Date.now() - pausedSince.current;
    return Date.now() - startedAt.current - pausedTotal.current - pausedNow;
  }, []);

  // A new puzzle: restart everything.
  useEffect(() => {
    startedAt.current = Date.now();
    pausedSince.current = null;
    pausedTotal.current = 0;
    expired.current = false;
    setRemainingMs(durationMs);
  }, [resetKey, durationMs]);

  // Pause bookkeeping.
  useEffect(() => {
    if (running) {
      if (pausedSince.current !== null) {
        pausedTotal.current += Date.now() - pausedSince.current;
        pausedSince.current = null;
      }
    } else if (pausedSince.current === null) {
      pausedSince.current = Date.now();
    }
  }, [running]);

  useEffect(() => {
    if (!running) return undefined;

    const timer = setInterval(() => {
      const left = durationMs - elapsed();
      setRemainingMs(Math.max(0, left));
      if (left <= 0 && !expired.current) {
        expired.current = true;
        expireCallback.current();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [running, durationMs, elapsed]);

  return { remainingMs, elapsed };
}

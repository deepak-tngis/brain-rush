import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  advance,
  answerCurrent,
  continueWithStreak,
  createSession,
  currentPuzzle,
  dailyConfig,
  dailyKey,
  restoreLife,
  revealAnswer,
} from '../engine';
import type { AnswerOutcome, GameMode, Puzzle, SessionState } from '../engine';
import { awardCoins, bankSession, recordAnswer } from '../storage/progressStore';

interface GameContextValue {
  readonly session: SessionState | null;
  readonly puzzle: Puzzle | null;
  /** Local date key the active daily run belongs to, or null for endless. */
  readonly dailyDateKey: string | null;
  /** A run may be revived once; after that a game over is final. */
  readonly canContinue: boolean;
  start(mode: GameMode): void;
  /** Applies an answer and returns what it earned, or null if it was ignored. */
  submit(optionId: string | null, elapsedMs: number, timedOut?: boolean): AnswerOutcome | null;
  next(): void;
  grantExtraLife(): void;
  grantReveal(): void;
  grantContinue(): void;
  clear(): void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }): ReactNode {
  const [session, setSession] = useState<SessionState | null>(null);
  const [dailyDateKey, setDailyDateKey] = useState<string | null>(null);

  /**
   * The live session is mirrored in a ref so that every transition can be
   * computed and its side effects (crediting coins, banking a run) run exactly
   * once, outside the state updater. React is free to call an updater more than
   * once; paying the player twice for one answer is not acceptable.
   */
  const sessionRef = useRef<SessionState | null>(null);
  const dailyKeyRef = useRef<string | null>(null);

  /** The streak the player was on when their last life went. */
  const streakBeforeGameOver = useRef(0);
  /** A run is only counted in the statistics once, even if it is continued. */
  const runCounted = useRef(false);
  const [continueUsed, setContinueUsed] = useState(false);

  const apply = useCallback((next: SessionState | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const start = useCallback(
    (mode: GameMode) => {
      const key = mode === 'daily' ? dailyKey() : null;
      dailyKeyRef.current = key;
      setDailyDateKey(key);
      streakBeforeGameOver.current = 0;
      runCounted.current = false;
      setContinueUsed(false);

      apply(
        mode === 'daily'
          ? createSession(dailyConfig(key as string))
          : createSession({ mode: 'endless', seed: Math.floor(Math.random() * 2 ** 31) }),
      );
    },
    [apply],
  );

  const submit = useCallback(
    (optionId: string | null, elapsedMs: number, timedOut = false): AnswerOutcome | null => {
      const current = sessionRef.current;
      if (current === null) return null;

      const puzzle = currentPuzzle(current);
      if (puzzle === null) return null;

      const streakBefore = current.streak;
      const nextState = answerCurrent(current, { optionId, elapsedMs, timedOut });
      if (nextState === current) return null;

      const outcome = nextState.lastOutcome;

      // Coins are credited the moment they are earned, so closing the app on the
      // game-over screen never costs the player what they just won.
      if (outcome !== null && outcome.coinsAwarded > 0) awardCoins(outcome.coinsAwarded);
      recordAnswer(puzzle.kind, outcome?.correct ?? false, nextState.streak);

      if (nextState.status === 'gameOver') {
        streakBeforeGameOver.current = streakBefore;
        bankSession(nextState, dailyKeyRef.current, !runCounted.current);
        runCounted.current = true;
      }

      apply(nextState);
      return outcome;
    },
    [apply],
  );

  const next = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) return;

    const nextState = advance(current);
    if (nextState.status === 'completed' && current.status !== 'completed') {
      bankSession(nextState, dailyKeyRef.current, !runCounted.current);
      runCounted.current = true;
    }
    apply(nextState);
  }, [apply]);

  const grantExtraLife = useCallback(() => {
    const current = sessionRef.current;
    if (current !== null) apply(restoreLife(current));
  }, [apply]);

  const grantReveal = useCallback(() => {
    const current = sessionRef.current;
    if (current !== null) apply(revealAnswer(current));
  }, [apply]);

  const grantContinue = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) return;
    // Revive, restore the streak, and move past the puzzle that ended the run -
    // replaying the one they just failed would not be much of a reward.
    apply(advance(continueWithStreak(current, streakBeforeGameOver.current)));
    setContinueUsed(true);
  }, [apply]);

  const clear = useCallback(() => {
    dailyKeyRef.current = null;
    setDailyDateKey(null);
    runCounted.current = false;
    setContinueUsed(false);
    apply(null);
  }, [apply]);

  const value = useMemo<GameContextValue>(
    () => ({
      session,
      puzzle: session === null ? null : currentPuzzle(session),
      dailyDateKey,
      canContinue: !continueUsed,
      start,
      submit,
      next,
      grantExtraLife,
      grantReveal,
      grantContinue,
      clear,
    }),
    [
      session,
      dailyDateKey,
      continueUsed,
      start,
      submit,
      next,
      grantExtraLife,
      grantReveal,
      grantContinue,
      clear,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) throw new Error('useGame must be used inside a GameProvider');
  return value;
}

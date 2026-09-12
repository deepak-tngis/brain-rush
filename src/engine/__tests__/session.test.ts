import {
  COINS_PER_CORRECT,
  COINS_STREAK_10,
  COINS_STREAK_5,
  MAX_LIVES,
  POINTS_PER_CORRECT,
  STARTING_LIVES,
  streakBonusCoins,
} from '../scoring';
import {
  advance,
  answerCurrent,
  continueWithStreak,
  createSession,
  currentPuzzle,
  DAILY_QUESTION_COUNT,
  isAnswerRevealed,
  restoreLife,
  revealAnswer,
} from '../session';
import type { SessionState } from '../session';

function startEndless(seed = 1234): SessionState {
  return createSession({ mode: 'endless', seed });
}

function answerCorrectly(state: SessionState, elapsedMs = 1000): SessionState {
  const puzzle = currentPuzzle(state);
  if (puzzle === null) throw new Error('no puzzle to answer');
  return answerCurrent(state, { optionId: puzzle.answerId, elapsedMs });
}

function answerWrongly(state: SessionState): SessionState {
  const puzzle = currentPuzzle(state);
  if (puzzle === null) throw new Error('no puzzle to answer');
  const wrong = puzzle.options.find((option) => option.id !== puzzle.answerId);
  if (wrong === undefined) throw new Error('puzzle has no wrong option');
  return answerCurrent(state, { optionId: wrong.id, elapsedMs: 1000 });
}

describe('streak bonuses', () => {
  it('pays the small bonus on every fifth answer and the large one on every tenth', () => {
    expect(streakBonusCoins(4)).toBe(0);
    expect(streakBonusCoins(5)).toBe(COINS_STREAK_5);
    expect(streakBonusCoins(9)).toBe(0);
    expect(streakBonusCoins(10)).toBe(COINS_STREAK_10);
    expect(streakBonusCoins(15)).toBe(COINS_STREAK_5);
    expect(streakBonusCoins(20)).toBe(COINS_STREAK_10);
    expect(streakBonusCoins(0)).toBe(0);
  });
});

describe('answering', () => {
  it('starts with three lives and nothing banked', () => {
    const state = startEndless();
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.score).toBe(0);
    expect(state.coinsEarned).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('awards points and coins for a correct answer', () => {
    const state = answerCorrectly(startEndless());
    expect(state.score).toBeGreaterThanOrEqual(POINTS_PER_CORRECT);
    expect(state.coinsEarned).toBe(COINS_PER_CORRECT);
    expect(state.streak).toBe(1);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.lastOutcome?.correct).toBe(true);
  });

  it('pays more for a faster answer, but never less than the base', () => {
    const base = startEndless();
    const puzzle = currentPuzzle(base);
    if (puzzle === null) throw new Error('no puzzle');
    const fast = answerCorrectly(base, 100);
    const slow = answerCorrectly(base, puzzle.timeLimitMs);
    expect(fast.score).toBeGreaterThan(slow.score);
    expect(slow.score).toBeGreaterThanOrEqual(POINTS_PER_CORRECT);
  });

  it('costs a life and resets the streak on a wrong answer', () => {
    let state = answerCorrectly(startEndless());
    state = answerWrongly(state);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.streak).toBe(0);
    expect(state.wrongCount).toBe(1);
    expect(state.lastOutcome?.correct).toBe(false);
  });

  it('treats a run-out clock as a wrong answer', () => {
    const state = answerCurrent(startEndless(), {
      optionId: null,
      elapsedMs: 99999,
      timedOut: true,
    });
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.lastOutcome?.timedOut).toBe(true);
  });

  it('ends the game when the third life is lost', () => {
    let state = startEndless();
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      state = answerWrongly(state);
      if (state.status === 'playing') state = advance(state);
    }
    expect(state.lives).toBe(0);
    expect(state.status).toBe('gameOver');
  });

  it('ignores answers once the game is over', () => {
    let state = startEndless();
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      state = answerWrongly(state);
      if (state.status === 'playing') state = advance(state);
    }
    const frozen = answerCorrectly(state);
    expect(frozen).toBe(state);
  });

  it('pays the streak bonuses during a real run', () => {
    let state = startEndless();
    let previousCoins = 0;
    const bonusesSeen: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      state = answerCorrectly(state);
      bonusesSeen.push(state.coinsEarned - previousCoins - COINS_PER_CORRECT);
      previousCoins = state.coinsEarned;
      state = advance(state);
    }
    expect(bonusesSeen[4]).toBe(COINS_STREAK_5);
    expect(bonusesSeen[9]).toBe(COINS_STREAK_10);
    expect(state.bestStreakInRun).toBe(10);
  });
});

describe('endless mode', () => {
  it('keeps generating puzzles indefinitely', () => {
    let state = startEndless();
    for (let i = 0; i < 40; i += 1) {
      expect(currentPuzzle(state)).not.toBeNull();
      state = answerCorrectly(state);
      state = advance(state);
    }
    expect(state.status).toBe('playing');
    expect(state.correctCount).toBe(40);
  });
});

describe('daily mode', () => {
  it('completes after exactly ten questions', () => {
    let state = createSession({ mode: 'daily', seed: 777 });
    expect(state.puzzles).toHaveLength(DAILY_QUESTION_COUNT);
    for (let i = 0; i < DAILY_QUESTION_COUNT; i += 1) {
      state = answerCorrectly(state);
      state = advance(state);
    }
    expect(state.status).toBe('completed');
    expect(state.correctCount).toBe(DAILY_QUESTION_COUNT);
  });

  it('can still end early when lives run out', () => {
    let state = createSession({ mode: 'daily', seed: 777 });
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      state = answerWrongly(state);
      if (state.status === 'playing') state = advance(state);
    }
    expect(state.status).toBe('gameOver');
  });
});

describe('rewarded-ad rewards', () => {
  it('restores one life and resumes a finished game', () => {
    let state = startEndless();
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      state = answerWrongly(state);
      if (state.status === 'playing') state = advance(state);
    }
    const resumed = restoreLife(state);
    expect(resumed.lives).toBe(1);
    expect(resumed.status).toBe('playing');
  });

  it('never pushes lives past the cap', () => {
    let state = startEndless();
    for (let i = 0; i < 10; i += 1) state = restoreLife(state);
    expect(state.lives).toBe(MAX_LIVES);
  });

  it('restores the streak the player was on when continuing', () => {
    let state = startEndless();
    for (let i = 0; i < 4; i += 1) {
      state = answerCorrectly(state);
      state = advance(state);
    }
    const streakBefore = state.streak;
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      state = answerWrongly(state);
      if (state.status === 'playing') state = advance(state);
    }
    expect(state.streak).toBe(0);

    const resumed = continueWithStreak(state, streakBefore);
    expect(resumed.streak).toBe(streakBefore);
    expect(resumed.status).toBe('playing');
  });

  it('marks the current answer as revealed, once', () => {
    const state = startEndless();
    expect(isAnswerRevealed(state)).toBe(false);
    const revealed = revealAnswer(state);
    expect(isAnswerRevealed(revealed)).toBe(true);
    expect(revealAnswer(revealed).revealedPuzzleIds).toHaveLength(1);
  });
});

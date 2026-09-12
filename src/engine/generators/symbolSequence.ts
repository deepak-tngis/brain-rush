import { baseTimeLimit, optionCountFor } from '../difficulty';
import {
  AmbiguousPuzzleError,
  finalizePuzzle,
  hiddenCell,
  labelCell,
  plausiblePeriodicNexts,
  textOption,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, PuzzleDraft } from '../types';

/** Glyphs that stay legible at small sizes on Android's default font stack. */
const SYMBOLS: readonly string[] = ['★', '●', '▲', '◆', '■', '♥', '✚', '☀', '☾', '♦', '▼', '◼'];

/** Visually close pairs, used to make the hard band deceptive rather than long. */
const CONFUSABLE: readonly string[] = ['■', '◼', '◆', '♦', '▲', '▼'];

interface CyclePlan {
  readonly visible: readonly string[];
  readonly answer: string;
  readonly alphabet: readonly string[];
  readonly period: number;
}

function buildCycle(rng: Rng, difficulty: Difficulty): CyclePlan | null {
  const period = difficulty === 'easy' ? rng.int(2, 3) : difficulty === 'medium' ? rng.int(3, 4) : rng.int(4, 5);
  const alphabetPool = difficulty === 'hard' && rng.bool(0.5) ? CONFUSABLE : SYMBOLS;
  if (alphabetPool.length < period) return null;

  const alphabet = rng.sample(alphabetPool, period);
  const tail = rng.int(1, period - 1);
  const visibleLength = period * 2 + tail;

  const visible: string[] = [];
  for (let i = 0; i < visibleLength; i += 1) visible.push(alphabet[i % period] as string);
  const answer = alphabet[visibleLength % period] as string;

  const nexts = plausiblePeriodicNexts(visible);
  if (nexts.length !== 1 || nexts[0] !== answer) return null;

  return { visible, answer, alphabet, period };
}

function cyclePuzzle(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  let plan: CyclePlan | null = null;
  for (let attempt = 0; attempt < 60 && plan === null; attempt += 1) {
    plan = buildCycle(rng, difficulty);
  }
  if (plan === null) {
    throw new AmbiguousPuzzleError('symbolSequence could not find an unambiguous cycle');
  }

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const seen = new Set<string>([plan.answer]);
  const distractors: string[] = [];
  for (const symbol of [...rng.shuffle(plan.alphabet), ...rng.shuffle(SYMBOLS)]) {
    if (distractors.length >= optionCount - 1) break;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    distractors.push(symbol);
  }
  if (distractors.length < optionCount - 1) {
    throw new AmbiguousPuzzleError('symbolSequence ran out of distractors');
  }

  const cells: Cell[] = [
    ...plan.visible.map((symbol) => labelCell(symbol, 'blue')),
    hiddenCell(),
  ];

  return finalizePuzzle(
    {
      kind: 'symbolSequence',
      difficulty,
      title: 'Symbol Sequence',
      instruction: 'Which symbol comes next?',
      board: { kind: 'row', cells },
      contents: [textOption(plan.answer), ...distractors.map(textOption)],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: `The symbols repeat every ${plan.period} steps.`,
    },
    rng,
  );
}

/**
 * Growth variant: the same symbol repeated a growing number of times. The rule
 * is arithmetic on the repeat count, so the answer is forced.
 */
function growthPuzzle(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const symbol = rng.pick(SYMBOLS);
  const start = rng.int(1, 2);
  const step = difficulty === 'hard' ? rng.int(1, 2) : 1;
  const visibleCount = difficulty === 'easy' ? 3 : 4;

  const counts: number[] = [];
  for (let i = 0; i < visibleCount + 1; i += 1) counts.push(start + i * step);
  const answerCount = counts[visibleCount] as number;
  const answer = symbol.repeat(answerCount);

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const seen = new Set<number>([answerCount]);
  const distractorCounts: number[] = [];
  for (let delta = 1; distractorCounts.length < optionCount - 1 && delta < 12; delta += 1) {
    for (const sign of rng.shuffle([-1, 1])) {
      const value = answerCount + delta * sign;
      if (value < 1 || seen.has(value)) continue;
      seen.add(value);
      distractorCounts.push(value);
      if (distractorCounts.length >= optionCount - 1) break;
    }
  }
  if (distractorCounts.length < optionCount - 1) {
    throw new AmbiguousPuzzleError('symbolSequence growth ran out of distractors');
  }

  const cells: Cell[] = [
    ...counts.slice(0, visibleCount).map((count) => labelCell(symbol.repeat(count), 'blue', { scale: 0.75 })),
    hiddenCell(),
  ];

  return finalizePuzzle(
    {
      kind: 'symbolSequence',
      difficulty,
      title: 'Symbol Sequence',
      instruction: 'Which group comes next?',
      board: { kind: 'row', cells },
      contents: [
        textOption(answer),
        ...distractorCounts.map((count) => textOption(symbol.repeat(count))),
      ],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: `Each step adds ${step} more ${symbol}. Next comes ${answerCount}.`,
    },
    rng,
  );
}

export function generateSymbolSequence(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  return rng.bool(difficulty === 'easy' ? 0.35 : 0.4)
    ? growthPuzzle(rng, difficulty)
    : cyclePuzzle(rng, difficulty);
}

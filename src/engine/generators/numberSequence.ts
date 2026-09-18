import { baseTimeLimit, isHardOrAbove, optionCountFor } from '../difficulty';
import { fitsAnyFamily, hasUniqueContinuation, predictNext, smallPrimes } from '../numericRules';
import {
  AmbiguousPuzzleError,
  finalizePuzzle,
  hiddenCell,
  labelCell,
  numericDistractors,
  textOption,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, PuzzleDraft } from '../types';

type Shape =
  | 'add'
  | 'double'
  | 'grow'
  | 'alternate'
  | 'fib'
  | 'squares'
  | 'affine'
  | 'primes'
  | 'interleaved';

const SHAPES_BY_DIFFICULTY: Readonly<Record<Difficulty, readonly Shape[]>> = {
  easy: ['add', 'double'],
  medium: ['add', 'double', 'grow', 'alternate', 'squares'],
  hard: ['grow', 'alternate', 'fib', 'double', 'affine', 'primes', 'squares'],
  expert: ['grow', 'alternate', 'fib', 'affine', 'primes', 'interleaved', 'add'],
};

interface Candidate {
  readonly terms: number[];
  readonly answer: number;
  readonly explanation: string;
  /**
   * Values a player lands on by applying a *nearly* right rule — continuing
   * the last gap instead of the growing one, multiplying without the add-on.
   * Offered ahead of random near-misses, because a puzzle whose wrong answers
   * are all obviously wrong is a puzzle solved by elimination.
   */
  readonly traps: number[];
}

function buildCandidate(rng: Rng, difficulty: Difficulty): Candidate | null {
  const hardish = isHardOrAbove(difficulty);
  const expert = difficulty === 'expert';
  const shape = rng.pick(SHAPES_BY_DIFFICULTY[difficulty]);
  const visibleCount = difficulty === 'easy' ? 4 : shape === 'interleaved' ? 6 : 5;

  const terms: number[] = [];
  const traps: number[] = [];
  let explanation = '';

  switch (shape) {
    case 'add': {
      const maxStep = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 14 : expert ? 27 : 19;
      const negative = rng.bool(expert ? 0.4 : 0.25);
      const step = rng.int(expert ? 6 : 2, maxStep) * (negative ? -1 : 1);
      let value = negative
        ? rng.int(expert ? 120 : 60, expert ? 180 : 99)
        : rng.int(1, hardish ? 50 : 20);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += step;
      }
      explanation = `Each number ${step > 0 ? 'adds' : 'subtracts'} ${Math.abs(step)}.`;
      break;
    }
    case 'double': {
      const ratio = expert ? rng.int(2, 4) : hardish ? rng.pick([2, 3]) : 2;
      let value = rng.int(expert ? 2 : 1, ratio === 2 ? 6 : ratio === 3 ? 4 : 3);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value *= ratio;
      }
      const last = terms[visibleCount - 1] as number;
      traps.push(last + (last - (terms[visibleCount - 2] as number)), last * ratio + ratio);
      explanation = `Each number is multiplied by ${ratio}.`;
      break;
    }
    case 'grow': {
      const growth = rng.int(expert ? 2 : 1, expert ? 8 : hardish ? 6 : 3);
      let step = rng.int(1, 5);
      let value = rng.int(1, expert ? 20 : 9);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += step;
        step += growth;
      }
      const last = terms[visibleCount - 1] as number;
      traps.push(last + (last - (terms[visibleCount - 2] as number)));
      explanation = `The gap grows by ${growth} each time.`;
      break;
    }
    case 'alternate': {
      const up = rng.int(expert ? 7 : hardish ? 5 : 4, expert ? 22 : hardish ? 15 : 12);
      const down = rng.int(expert ? 2 : 1, expert ? 9 : hardish ? 6 : 3);
      if (up === down) return null;
      let value = rng.int(expert ? 5 : 2, expert ? 40 : 15);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += i % 2 === 0 ? up : -down;
      }
      const last = terms[visibleCount - 1] as number;
      // Applying the wrong one of the two steps.
      traps.push(visibleCount % 2 === 0 ? last - down : last + up);
      explanation = `The steps alternate: +${up} then -${down}.`;
      break;
    }
    case 'fib': {
      let a = rng.int(expert ? 2 : 1, expert ? 9 : 6);
      let b = rng.int(a + (expert ? 2 : 1), a + (expert ? 12 : 7));
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(a);
        const sum = a + b;
        a = b;
        b = sum;
      }
      const last = terms[visibleCount - 1] as number;
      traps.push(last + (last - (terms[visibleCount - 2] as number)), last * 2);
      explanation = 'Each number is the sum of the two before it.';
      break;
    }
    case 'squares': {
      const first = rng.int(1, hardish ? 6 : 3);
      for (let i = 0; i <= visibleCount; i += 1) terms.push((first + i) * (first + i));
      const last = terms[visibleCount - 1] as number;
      traps.push(last + (last - (terms[visibleCount - 2] as number)));
      const root = first + visibleCount;
      explanation = `They are the square numbers: ${root} x ${root} comes next.`;
      break;
    }
    case 'affine': {
      const a = expert ? rng.pick([2, 3]) : 2;
      const b = expert && rng.bool(0.4) ? -rng.int(1, 4) : rng.int(1, expert ? 6 : 5);
      let value = b < 0 ? rng.int(5, 8) : rng.int(1, a === 3 ? 4 : 5);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value = a * value + b;
      }
      const last = terms[visibleCount - 1] as number;
      traps.push(last * a, last + (last - (terms[visibleCount - 2] as number)));
      const tail = b > 0 ? `${b} is added` : `${-b} is taken away`;
      explanation = `Each number is multiplied by ${a}, then ${tail}.`;
      break;
    }
    case 'primes': {
      const list = smallPrimes();
      const start = rng.int(expert ? 4 : 0, expert ? 16 : 7);
      for (let i = 0; i <= visibleCount; i += 1) terms.push(list[start + i] as number);
      const last = terms[visibleCount - 1] as number;
      traps.push(last + 2, last + (last - (terms[visibleCount - 2] as number)));
      explanation = 'They are the prime numbers in order.';
      break;
    }
    case 'interleaved': {
      const stepA = rng.int(2, 9);
      const falling = rng.bool(0.5);
      const stepB = (falling ? -1 : 1) * rng.int(2, 9);
      if (stepA === stepB) return null;
      let a = rng.int(1, 20);
      let b = falling ? rng.int(40, 90) : rng.int(1, 40);
      for (let i = 0; i <= visibleCount; i += 1) {
        if (i % 2 === 0) {
          terms.push(a);
          a += stepA;
        } else {
          terms.push(b);
          b += stepB;
        }
      }
      const last = terms[visibleCount - 1] as number;
      // Continuing the wrong lane, and reading the whole thing as one run.
      traps.push(last + stepB, last + (last - (terms[visibleCount - 2] as number)));
      const other = stepB > 0 ? `adds ${stepB}` : `subtracts ${-stepB}`;
      explanation = `Two sequences take turns: one adds ${stepA}, the other ${other}.`;
      break;
    }
    default:
      return null;
  }

  const visible = terms.slice(0, visibleCount);
  const answer = terms[visibleCount] as number;

  if (visible.some((value) => value < 0 || value > 9999)) return null;
  if (answer < 0 || answer > 9999) return null;
  // The universe of rules must agree on one continuation, and it must be ours.
  if (!hasUniqueContinuation(visible)) return null;
  if (predictNext(visible)[0] !== answer) return null;

  return { terms: visible, answer, explanation, traps };
}

export function generateNumberSequence(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  let candidate: Candidate | null = null;
  for (let attempt = 0; attempt < 80 && candidate === null; attempt += 1) {
    candidate = buildCandidate(rng, difficulty);
  }
  if (candidate === null) {
    throw new AmbiguousPuzzleError('numberSequence could not find an unambiguous run');
  }

  const { terms, answer, explanation, traps } = candidate;
  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.2));

  // A distractor is only fair if appending it would *not* produce a run that any
  // rule in the universe explains — i.e. it is provably not a valid answer.
  const unfair = (value: number): boolean => value < 0 || fitsAnyFamily([...terms, value]);

  const chosen: number[] = [];
  const seen = new Set<number>([answer]);
  if (isHardOrAbove(difficulty)) {
    for (const trap of rng.shuffle(traps)) {
      if (chosen.length >= 2) break;
      if (!Number.isInteger(trap) || seen.has(trap) || unfair(trap)) continue;
      seen.add(trap);
      chosen.push(trap);
    }
  }
  const remaining = optionCount - 1 - chosen.length;
  if (remaining > 0) {
    chosen.push(
      ...numericDistractors(rng, answer, remaining, spread, {
        reject: (value) => seen.has(value) || unfair(value),
      }),
    );
  }

  const cells: Cell[] = [
    ...terms.map((value) => labelCell(String(value))),
    hiddenCell(),
  ];

  const contents = [textOption(String(answer)), ...chosen.map((v) => textOption(String(v)))];

  return finalizePuzzle(
    {
      kind: 'numberSequence',
      difficulty,
      title: 'Number Sequence',
      instruction: 'What comes next?',
      board: { kind: 'row', cells },
      contents,
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: `${explanation} The next number is ${answer}.`,
    },
    rng,
  );
}

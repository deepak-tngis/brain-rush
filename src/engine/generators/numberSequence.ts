import { baseTimeLimit, optionCountFor } from '../difficulty';
import { fitsAnyFamily, hasUniqueContinuation, predictNext } from '../numericRules';
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

interface Candidate {
  readonly terms: number[];
  readonly answer: number;
  readonly explanation: string;
}

function buildCandidate(rng: Rng, difficulty: Difficulty): Candidate | null {
  const visibleCount = difficulty === 'easy' ? 4 : 5;

  const shape =
    difficulty === 'easy'
      ? rng.pick(['add', 'double'] as const)
      : difficulty === 'medium'
        ? rng.pick(['add', 'double', 'grow', 'alternate'] as const)
        : rng.pick(['grow', 'alternate', 'fib', 'double'] as const);

  const terms: number[] = [];
  let explanation = '';

  switch (shape) {
    case 'add': {
      const step = rng.int(2, difficulty === 'easy' ? 9 : 14) * (rng.bool(0.25) ? -1 : 1);
      let value = rng.int(step < 0 ? 60 : 1, step < 0 ? 99 : 20);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += step;
      }
      explanation = `Each number ${step > 0 ? 'adds' : 'subtracts'} ${Math.abs(step)}.`;
      break;
    }
    case 'double': {
      const ratio = difficulty === 'hard' ? rng.pick([2, 3]) : 2;
      let value = rng.int(1, ratio === 2 ? 6 : 4);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value *= ratio;
      }
      explanation = `Each number is multiplied by ${ratio}.`;
      break;
    }
    case 'grow': {
      const growth = rng.int(1, difficulty === 'hard' ? 6 : 3);
      let step = rng.int(1, 5);
      let value = rng.int(1, 9);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += step;
        step += growth;
      }
      explanation = `The gap grows by ${growth} each time.`;
      break;
    }
    case 'alternate': {
      const up = rng.int(4, 12);
      const down = rng.int(1, 3);
      if (up === down) return null;
      let value = rng.int(2, 15);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(value);
        value += i % 2 === 0 ? up : -down;
      }
      explanation = `The steps alternate: +${up} then -${down}.`;
      break;
    }
    case 'fib': {
      let a = rng.int(1, 6);
      let b = rng.int(a + 1, a + 7);
      for (let i = 0; i <= visibleCount; i += 1) {
        terms.push(a);
        const sum = a + b;
        a = b;
        b = sum;
      }
      explanation = 'Each number is the sum of the two before it.';
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

  return { terms: visible, answer, explanation };
}

export function generateNumberSequence(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  let candidate: Candidate | null = null;
  for (let attempt = 0; attempt < 80 && candidate === null; attempt += 1) {
    candidate = buildCandidate(rng, difficulty);
  }
  if (candidate === null) {
    throw new AmbiguousPuzzleError('numberSequence could not find an unambiguous run');
  }

  const { terms, answer, explanation } = candidate;
  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.2));

  // A distractor is only fair if appending it would *not* produce a run that any
  // rule in the universe explains — i.e. it is provably not a valid answer.
  const distractors = numericDistractors(rng, answer, optionCount - 1, spread, {
    reject: (value) => value < 0 || fitsAnyFamily([...terms, value]),
  });

  const cells: Cell[] = [
    ...terms.map((value) => labelCell(String(value))),
    hiddenCell(),
  ];

  const contents = [textOption(String(answer)), ...distractors.map((v) => textOption(String(v)))];

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

import { baseTimeLimit, optionCountFor } from '../difficulty';
import { fitsAnyFamily, hasUniqueContinuation } from '../numericRules';
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

interface SeriesCandidate {
  readonly kind: 'series';
  readonly terms: number[];
  readonly holeIndex: number;
  readonly answer: number;
  readonly explanation: string;
}

interface GridCandidate {
  readonly kind: 'grid';
  readonly rows: ReadonlyArray<readonly [number, number, number]>;
  readonly holeRow: number;
  readonly holeCol: number;
  readonly answer: number;
  readonly explanation: string;
  readonly operator: '+' | '-' | 'x';
}

/**
 * A gap in the middle of a run is pinned down from both sides, which makes it
 * the strictest of the numeric puzzles: the candidate has to reproduce the rule
 * looking forwards *and* backwards.
 */
function buildSeries(rng: Rng, difficulty: Difficulty): SeriesCandidate | null {
  const length = difficulty === 'easy' ? 5 : 6;
  const shape = difficulty === 'easy' ? rng.pick(['add', 'double'] as const) : rng.pick(['add', 'double', 'grow'] as const);

  const terms: number[] = [];
  let explanation = '';

  if (shape === 'add') {
    const step = rng.int(2, difficulty === 'hard' ? 15 : 9) * (rng.bool(0.25) ? -1 : 1);
    let value = rng.int(step < 0 ? 70 : 1, step < 0 ? 120 : 20);
    for (let i = 0; i < length; i += 1) {
      terms.push(value);
      value += step;
    }
    explanation = `Each step ${step > 0 ? 'adds' : 'subtracts'} ${Math.abs(step)}.`;
  } else if (shape === 'double') {
    const ratio = difficulty === 'hard' ? rng.pick([2, 3]) : 2;
    let value = rng.int(1, ratio === 2 ? 5 : 3);
    for (let i = 0; i < length; i += 1) {
      terms.push(value);
      value *= ratio;
    }
    explanation = `Each step multiplies by ${ratio}.`;
  } else {
    const growth = rng.int(1, 4);
    let step = rng.int(1, 5);
    let value = rng.int(1, 9);
    for (let i = 0; i < length; i += 1) {
      terms.push(value);
      value += step;
      step += growth;
    }
    explanation = `The gap grows by ${growth} each step.`;
  }

  if (terms.some((value) => value < 0 || value > 9999)) return null;
  if (!hasUniqueContinuation(terms)) return null;

  // Hide an interior term so both neighbours constrain the answer.
  const holeIndex = rng.int(1, length - 2);
  return {
    kind: 'series',
    terms,
    holeIndex,
    answer: terms[holeIndex] as number,
    explanation,
  };
}

/**
 * Row operators the validator is willing to consider. The generator only ever
 * *uses* +, - and x, but a player could read a division into a row of numbers,
 * so / is checked too when proving the grid has a single answer.
 */
type RowOperator = '+' | '-' | 'x' | '/';

const ROW_OPERATORS: readonly RowOperator[] = ['+', '-', 'x', '/'];

function applyOperator(op: RowOperator, a: number, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case 'x':
      return a * b;
    case '/':
      return b !== 0 && a % b === 0 ? a / b : null;
    default:
      return null;
  }
}

function rowFits(op: RowOperator, row: readonly [number, number, number]): boolean {
  return applyOperator(op, row[0], row[1]) === row[2];
}

/** Solves a row for whichever position is blank, or null when unsolvable. */
function solveRow(
  op: RowOperator,
  row: readonly [number, number, number],
  holeCol: number,
): number | null {
  const [a, b, c] = row;
  const integral = (value: number | null): number | null =>
    value !== null && Number.isInteger(value) && value >= 0 ? value : null;

  if (holeCol === 2) return integral(applyOperator(op, a, b));
  if (holeCol === 0) {
    switch (op) {
      case '+':
        return integral(c - b);
      case '-':
        return integral(c + b);
      case 'x':
        return integral(b !== 0 && c % b === 0 ? c / b : null);
      case '/':
        return integral(c * b);
      default:
        return null;
    }
  }
  switch (op) {
    case '+':
      return integral(c - a);
    case '-':
      return integral(a - c);
    case 'x':
      return integral(a !== 0 && c % a === 0 ? c / a : null);
    case '/':
      return integral(c !== 0 && a % c === 0 ? a / c : null);
    default:
      return null;
  }
}

function buildGrid(rng: Rng, difficulty: Difficulty): GridCandidate | null {
  const operator = difficulty === 'hard' ? rng.pick(['+', '-', 'x'] as const) : rng.pick(['+', '-'] as const);
  const max = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 15 : 12;

  const rows: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < 3; i += 1) {
    const a = rng.int(2, max);
    const b = operator === '-' ? rng.int(1, a - 1) : rng.int(2, max);
    const c = applyOperator(operator, a, b);
    if (c === null || c > 999) return null;
    rows.push([a, b, c] as const);
  }
  // Repeated rows would teach the rule twice and prove nothing.
  const fingerprints = new Set(rows.map((row) => row.join(',')));
  if (fingerprints.size !== rows.length) return null;

  const holeRow = 2;
  const holeCol = rng.int(0, 2);
  const answer = (rows[holeRow] as readonly [number, number, number])[holeCol];

  // The two complete rows must single out one operator's worth of answers: if
  // any other operator also explains them and implies a different value for the
  // gap, the grid has two defensible answers and is thrown away.
  const explanations = new Set<number>();
  for (const op of ROW_OPERATORS) {
    const fitsVisibleRows = rows
      .slice(0, holeRow)
      .every((row) => rowFits(op, row as readonly [number, number, number]));
    if (!fitsVisibleRows) continue;
    const solved = solveRow(op, rows[holeRow] as readonly [number, number, number], holeCol);
    if (solved !== null) explanations.add(solved);
  }
  if (explanations.size !== 1 || !explanations.has(answer)) return null;

  const label =
    operator === '+'
      ? 'first + second = third'
      : operator === '-'
        ? 'first - second = third'
        : 'first x second = third';

  return {
    kind: 'grid',
    rows,
    holeRow,
    holeCol,
    answer,
    explanation: `Every row follows the same rule: ${label}.`,
    operator,
  };
}

function seriesCells(candidate: SeriesCandidate): Cell[] {
  return candidate.terms.map((value, index) =>
    index === candidate.holeIndex ? hiddenCell() : labelCell(String(value)),
  );
}

function gridCells(candidate: GridCandidate): Cell[] {
  const cells: Cell[] = [];
  const symbol = candidate.operator === 'x' ? 'x' : candidate.operator;
  candidate.rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const isHole = rowIndex === candidate.holeRow && colIndex === candidate.holeCol;
      cells.push(isHole ? hiddenCell() : labelCell(String(value)));
      if (colIndex === 0) cells.push({ ...labelCell(symbol), muted: true, scale: 0.8 });
      if (colIndex === 1) cells.push({ ...labelCell('='), muted: true, scale: 0.8 });
    });
  });
  return cells;
}

export function generateMissingNumber(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const useGrid = rng.bool(difficulty === 'easy' ? 0.35 : 0.5);
  const optionCount = optionCountFor(difficulty, 4, 4, 6);

  if (useGrid) {
    let candidate: GridCandidate | null = null;
    for (let attempt = 0; attempt < 80 && candidate === null; attempt += 1) {
      candidate = buildGrid(rng, difficulty);
    }
    if (candidate === null) {
      throw new AmbiguousPuzzleError('missingNumber could not find an unambiguous grid');
    }
    const spread = Math.max(3, Math.round(candidate.answer * 0.3));
    const distractors = numericDistractors(rng, candidate.answer, optionCount - 1, spread);
    const contents = [
      textOption(String(candidate.answer)),
      ...distractors.map((value) => textOption(String(value))),
    ];
    return finalizePuzzle(
      {
        kind: 'missingNumber',
        difficulty,
        title: 'Missing Number',
        instruction: 'Every row follows the same rule. Fill the gap',
        // 3 values + 2 operator glyphs per row.
        board: { kind: 'grid', cols: 5, cells: gridCells(candidate) },
        contents,
        answerIndex: 0,
        timeLimitMs: baseTimeLimit(difficulty, 1.1),
        explanation: `${candidate.explanation} The missing value is ${candidate.answer}.`,
      },
      rng,
    );
  }

  let candidate: SeriesCandidate | null = null;
  for (let attempt = 0; attempt < 80 && candidate === null; attempt += 1) {
    candidate = buildSeries(rng, difficulty);
  }
  if (candidate === null) {
    throw new AmbiguousPuzzleError('missingNumber could not find an unambiguous run');
  }

  const { terms, holeIndex, answer, explanation } = candidate;
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.25));

  // Rejecting any value that would also make the run rule-consistent is what
  // keeps the gap single-valued.
  const distractors = numericDistractors(rng, answer, optionCount - 1, spread, {
    reject: (value) => {
      if (value < 0) return true;
      const filled = terms.slice();
      filled[holeIndex] = value;
      return fitsAnyFamily(filled);
    },
  });

  const contents = [textOption(String(answer)), ...distractors.map((v) => textOption(String(v)))];

  return finalizePuzzle(
    {
      kind: 'missingNumber',
      difficulty,
      title: 'Missing Number',
      instruction: 'Which number is missing?',
      board: { kind: 'row', cells: seriesCells(candidate) },
      contents,
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: `${explanation} The missing number is ${answer}.`,
    },
    rng,
  );
}

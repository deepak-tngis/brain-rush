import { baseTimeLimit, isHardOrAbove } from '../difficulty';
import {
  AmbiguousPuzzleError,
  cell,
  cellOption,
  finalizePuzzle,
  hiddenCell,
  operatorCell,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal', 'red', 'yellow'];
const ARROW = '→';

/**
 * Mappings are laid out two per line. Stacking five or six of them vertically
 * would push the board taller than a phone screen can give it.
 */
const MAPPINGS_PER_ROW = 2;

/**
 * The colour set doubles as the answer set, so it never drops below four: a
 * three-way choice would make guessing too cheap next to the other puzzle types.
 */
function sizeFor(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 4;
  if (difficulty === 'medium') return 5;
  return 6;
}

/** A permutation with no fixed points, so no rule reads as "stays the same". */
function derangement(rng: Rng, size: number): number[] {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = rng.shuffle(Array.from({ length: size }, (_unused, index) => index));
    if (candidate.every((value, index) => value !== index)) return candidate;
  }
  // Fall back to a single cycle, which is a derangement by construction.
  return Array.from({ length: size }, (_unused, index) => (index + 1) % size);
}

/**
 * Bijection variant.
 *
 * Every colour maps to a *different* colour, and all but one of the mappings are
 * shown. Because the mapping is one-to-one, the missing target must be the only
 * colour that is not already used as an output — a single forced answer that the
 * player can derive rather than guess.
 */
function bijectionPuzzle(rng: Rng, difficulty: Difficulty, shape: ShapeName): PuzzleDraft {
  const size = sizeFor(difficulty);
  const colors = rng.sample(COLORS, size);
  const mapping = derangement(rng, size);

  const queryIndex = rng.int(0, size - 1);
  const answerColor = colors[mapping[queryIndex] as number] as GlyphColor;

  const cells: Cell[] = [];
  for (let i = 0; i < size; i += 1) {
    if (i === queryIndex) continue;
    cells.push(cell(shape, colors[i] as GlyphColor));
    cells.push(operatorCell(ARROW));
    cells.push(cell(shape, colors[mapping[i] as number] as GlyphColor));
  }
  cells.push(cell(shape, colors[queryIndex] as GlyphColor));
  cells.push(operatorCell(ARROW));
  cells.push(hiddenCell());

  const contents = colors.map((color) => cellOption(cell(shape, color)));
  const answerIndex = contents.findIndex(
    (content) => content.kind === 'cell' && content.cell.color === answerColor,
  );
  if (answerIndex < 0) throw new AmbiguousPuzzleError('colorLogic lost its answer');

  return finalizePuzzle(
    {
      kind: 'colorLogic',
      difficulty,
      title: 'Colour Logic',
      instruction: 'Each colour turns into a different one. What is missing?',
      board: { kind: 'grid', cols: MAPPINGS_PER_ROW * 3, cells },
      contents,
      answerIndex,
      timeLimitMs: baseTimeLimit(difficulty, 1.2),
      explanation: `Every colour is used exactly once as a result, and ${answerColor} is the only one left.`,
    },
    rng,
  );
}

/**
 * Cycle variant.
 *
 * The colours form one closed loop, every step is shown, and the question asks
 * where a colour lands after several steps — arithmetic on a cycle, so again a
 * single forced answer.
 */
function cyclePuzzle(rng: Rng, difficulty: Difficulty, shape: ShapeName): PuzzleDraft {
  const size = sizeFor(difficulty);
  const colors = rng.sample(COLORS, size);
  const steps =
    difficulty === 'expert' ? rng.int(3, 4) : isHardOrAbove(difficulty) ? rng.int(2, 3) : 2;

  const startIndex = rng.int(0, size - 1);
  const answerIndexInCycle = (startIndex + steps) % size;
  if (answerIndexInCycle === startIndex) {
    throw new AmbiguousPuzzleError('colorLogic cycle returned to its start');
  }
  const answerColor = colors[answerIndexInCycle] as GlyphColor;

  const cells: Cell[] = [];
  for (let i = 0; i < size; i += 1) {
    cells.push(cell(shape, colors[i] as GlyphColor));
    cells.push(operatorCell(ARROW));
    cells.push(cell(shape, colors[(i + 1) % size] as GlyphColor));
  }

  const contents = colors.map((color) => cellOption(cell(shape, color)));
  const answerIndex = contents.findIndex(
    (content) => content.kind === 'cell' && content.cell.color === answerColor,
  );
  if (answerIndex < 0) throw new AmbiguousPuzzleError('colorLogic lost its answer');

  const startColor = colors[startIndex] as GlyphColor;

  return finalizePuzzle(
    {
      kind: 'colorLogic',
      difficulty,
      title: 'Colour Logic',
      instruction: `Follow the arrows. Where does ${startColor} land after ${steps} steps?`,
      board: { kind: 'grid', cols: MAPPINGS_PER_ROW * 3, cells },
      contents,
      answerIndex,
      timeLimitMs: baseTimeLimit(difficulty, 1.2),
      explanation: `${startColor} moves ${steps} step${steps === 1 ? '' : 's'} along the loop and lands on ${answerColor}.`,
    },
    rng,
  );
}

export function generateColorLogic(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  // One neutral shape throughout keeps colour the only variable in play.
  const shape: ShapeName = rng.pick(['circle', 'square', 'hexagon'] as const);

  if (difficulty === 'easy' || rng.bool(0.5)) {
    return bijectionPuzzle(rng, difficulty, shape);
  }
  // `steps` can only land back on the start when it is a multiple of the cycle
  // length; falling back keeps the generator total.
  try {
    return cyclePuzzle(rng, difficulty, shape);
  } catch {
    return bijectionPuzzle(rng, difficulty, shape);
  }
}

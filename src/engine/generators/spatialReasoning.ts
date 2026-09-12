import { baseTimeLimit } from '../difficulty';
import {
  AmbiguousPuzzleError,
  cell,
  cellOption,
  cellSignature,
  finalizePuzzle,
  gridOption,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

/** Shapes with no rotational symmetry, so all four quarter-turns look different. */
const ASYMMETRIC_SHAPES: readonly ShapeName[] = ['arrow', 'flag', 'triangle', 'heart'];
const COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal'];

const TURNS = [90, 180, 270] as const;

function turnLabel(turn: number): string {
  if (turn === 90) return 'a quarter turn clockwise';
  if (turn === 180) return 'a half turn';
  return 'a quarter turn anticlockwise';
}

/** Single-glyph rotation: read the orientation, apply the turn. */
function glyphPuzzle(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const shape = rng.pick(ASYMMETRIC_SHAPES);
  const color = rng.pick(COLORS);
  const start = rng.pick([0, 90, 180, 270] as const);
  const turn = difficulty === 'easy' ? 90 : rng.pick(TURNS);

  const options = [0, 90, 180, 270].map((offset) =>
    cell(shape, color, { rotation: (start + offset) % 360 }),
  );
  // ASYMMETRIC_SHAPES is curated so that no member maps onto itself under a
  // quarter turn; this guard catches the case where a future addition breaks
  // that and collapses two options into the same rendering.
  const signatures = new Set(options.map(cellSignature));
  if (signatures.size !== 4) {
    throw new AmbiguousPuzzleError(`spatialReasoning: ${shape} is rotationally symmetric`);
  }

  const answerRotation = (start + turn) % 360;
  const answerIndex = options.findIndex((option) => option.rotation === answerRotation);

  return finalizePuzzle(
    {
      kind: 'spatialReasoning',
      difficulty,
      title: 'Spatial Reasoning',
      instruction: `Which one is this shape after ${turnLabel(turn)}?`,
      board: { kind: 'row', cells: [cell(shape, color, { rotation: start, scale: 1.2 })] },
      contents: options.map(cellOption),
      answerIndex,
      timeLimitMs: baseTimeLimit(difficulty, 1.15),
      explanation: `Turning the ${shape} by ${turn} degrees gives this orientation.`,
    },
    rng,
  );
}

function rotateGrid(filled: readonly boolean[], size: number): boolean[] {
  const out = new Array<boolean>(size * size).fill(false);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      // Clockwise: (row, col) -> (col, size - 1 - row)
      out[col * size + (size - 1 - row)] = filled[row * size + col] as boolean;
    }
  }
  return out;
}

function gridKey(filled: readonly boolean[]): string {
  return filled.map((value) => (value ? '1' : '0')).join('');
}

function toCells(filled: readonly boolean[], color: GlyphColor): Cell[] {
  return filled.map((isFilled) =>
    isFilled
      ? cell('square', color, { scale: 0.9 })
      : cell('blank', color, { filled: false, scale: 0.9 }),
  );
}

/**
 * Pattern rotation: a small grid and its own four rotations as the options.
 * The generator only ships a grid whose four rotations are all distinct, which
 * is exactly the condition for the asked rotation to have one correct answer.
 */
function gridPuzzle(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const size = 3;
  const fillCount = difficulty === 'medium' ? rng.int(3, 4) : rng.int(4, 5);
  const color = rng.pick(COLORS);
  const turn = difficulty === 'medium' ? 90 : rng.pick(TURNS);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const indices = rng.sample(
      Array.from({ length: size * size }, (_unused, index) => index),
      fillCount,
    );
    const base = new Array<boolean>(size * size).fill(false);
    for (const index of indices) base[index] = true;

    const r90 = rotateGrid(base, size);
    const r180 = rotateGrid(r90, size);
    const r270 = rotateGrid(r180, size);
    const rotations = [base, r90, r180, r270];

    // Four distinct renderings means the asked rotation matches exactly one.
    if (new Set(rotations.map(gridKey)).size !== 4) continue;

    const answerIndex = turn === 90 ? 1 : turn === 180 ? 2 : 3;

    return finalizePuzzle(
      {
        kind: 'spatialReasoning',
        difficulty,
        title: 'Spatial Reasoning',
        instruction: `Which grid is this pattern after ${turnLabel(turn)}?`,
        board: { kind: 'grid', cols: size, cells: toCells(base, color) },
        contents: rotations.map((rotation) => gridOption(size, toCells(rotation, color))),
        answerIndex,
        timeLimitMs: baseTimeLimit(difficulty, 1.3),
        explanation: `Rotating the pattern by ${turn} degrees moves every square to this position.`,
      },
      rng,
    );
  }

  throw new AmbiguousPuzzleError('spatialReasoning could not find an asymmetric grid');
}

export function generateSpatialReasoning(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  if (difficulty === 'easy') return glyphPuzzle(rng, difficulty);
  return rng.bool(0.5) ? glyphPuzzle(rng, difficulty) : gridPuzzle(rng, difficulty);
}

import { baseTimeLimit, optionCountFor } from '../difficulty';
import {
  AmbiguousPuzzleError,
  cell,
  cellSignature,
  finalizePuzzle,
  gridOption,
  optionSignature,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const SHAPES: readonly ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'hexagon', 'cross'];
const COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal', 'red', 'yellow'];

function randomCell(rng: Rng): Cell {
  return cell(rng.pick(SHAPES), rng.pick(COLORS), { scale: 0.9 });
}

/** Changes exactly one attribute of one cell — a near-miss, never a match. */
function mutate(rng: Rng, tile: readonly Cell[]): Cell[] {
  const copy = tile.slice();
  const index = rng.int(0, copy.length - 1);
  const source = copy[index] as Cell;
  copy[index] = rng.bool()
    ? { ...source, shape: rng.pick(SHAPES.filter((shape) => shape !== source.shape)) }
    : { ...source, color: rng.pick(COLORS.filter((color) => color !== source.color)) };
  return copy;
}

/**
 * Matching: find the tile identical to the target.
 *
 * Uniqueness is enforced twice over — every option must render differently from
 * every other (so there are no two identical tiles to choose between), and an
 * explicit count proves that exactly one option matches the target.
 */
export function generateMatching(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const tileSize = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const cols = tileSize;
  const optionCount = optionCountFor(difficulty, 4, 4, 6);

  const target: Cell[] = Array.from({ length: tileSize }, () => randomCell(rng));
  const targetSignature = target.map(cellSignature).join(',');

  const seen = new Set<string>([targetSignature]);
  const distractors: Cell[][] = [];
  for (let attempt = 0; attempt < 400 && distractors.length < optionCount - 1; attempt += 1) {
    // Near-misses at every difficulty; the harder bands just have more cells for
    // the single changed attribute to hide in.
    const candidate = mutate(rng, difficulty === 'easy' ? target : rng.bool(0.75) ? target : distractors[0] ?? target);
    const signature = candidate.map(cellSignature).join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    distractors.push(candidate);
  }
  if (distractors.length < optionCount - 1) {
    throw new AmbiguousPuzzleError('matching ran out of near-miss tiles');
  }

  const contents = [gridOption(cols, target), ...distractors.map((tile) => gridOption(cols, tile))];

  const answerSignature = optionSignature(gridOption(cols, target));
  const matches = contents.filter(
    (content) => optionSignature(content) === answerSignature,
  ).length;
  if (matches !== 1) {
    throw new AmbiguousPuzzleError(`matching offers ${matches} tiles identical to the target`);
  }

  return finalizePuzzle(
    {
      kind: 'matching',
      difficulty,
      title: 'Matching',
      instruction: 'Find the exact match',
      // The target is rendered at the same scale as the options so "identical"
      // means identical on screen, not merely in the data.
      board: { kind: 'grid', cols, cells: target },
      contents,
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, 1.15),
      explanation: 'Only one option matches the target exactly.',
    },
    rng,
  );
}

import { baseTimeLimit, optionCountFor } from '../difficulty';
import {
  AmbiguousPuzzleError,
  cell,
  cellOption,
  cellSignature,
  finalizePuzzle,
  hiddenCell,
  plausiblePeriodicNexts,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const SHAPE_POOL: readonly ShapeName[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'heart',
  'hexagon',
  'cross',
];

const COLOR_POOL: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal'];

interface PatternPlan {
  readonly cycle: readonly Cell[];
  readonly visible: readonly Cell[];
  readonly answer: Cell;
  readonly description: string;
}

/**
 * Builds a strictly repeating run that shows the cycle at least twice before the
 * gap. `plausiblePeriodicNexts` then *proves* that only one continuation is
 * defensible before the puzzle is allowed out.
 */
function buildPattern(rng: Rng, difficulty: Difficulty): PatternPlan | null {
  const period = difficulty === 'easy' ? rng.int(2, 3) : difficulty === 'medium' ? rng.int(3, 4) : rng.int(4, 5);
  const repeats = 2;
  const tailLength = rng.int(1, period - 1);
  const visibleLength = period * repeats + tailLength;

  const varyColor = difficulty !== 'easy' && rng.bool(0.5);
  const cycle: Cell[] = [];

  if (varyColor) {
    // Shape stays fixed so the colour rhythm is the only thing to read.
    const shape = rng.pick(SHAPE_POOL);
    const colors = rng.sample(COLOR_POOL, period);
    for (const color of colors) cycle.push(cell(shape, color));
  } else {
    const shapes = rng.sample(SHAPE_POOL, period);
    const color = rng.pick(COLOR_POOL);
    for (const shape of shapes) cycle.push(cell(shape, color));
  }

  const visible: Cell[] = [];
  for (let i = 0; i < visibleLength; i += 1) {
    visible.push(cycle[i % period] as Cell);
  }
  const answer = cycle[visibleLength % period] as Cell;

  const signatures = visible.map(cellSignature);
  const nexts = plausiblePeriodicNexts(signatures);
  if (nexts.length !== 1 || nexts[0] !== cellSignature(answer)) return null;

  return {
    cycle,
    visible,
    answer,
    description: varyColor
      ? `The colours repeat every ${period} shapes.`
      : `The shapes repeat every ${period} steps.`,
  };
}

export function generateShapePattern(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  let plan: PatternPlan | null = null;
  for (let attempt = 0; attempt < 60 && plan === null; attempt += 1) {
    plan = buildPattern(rng, difficulty);
  }
  if (plan === null) {
    throw new AmbiguousPuzzleError('shapePattern could not find an unambiguous cycle');
  }

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const answerSignature = cellSignature(plan.answer);

  // Other members of the cycle make the sharpest distractors: they are all
  // visibly present, yet only one of them lands on the right beat.
  const pool: Cell[] = [];
  const seen = new Set<string>([answerSignature]);
  for (const candidate of rng.shuffle(plan.cycle)) {
    const signature = cellSignature(candidate);
    if (seen.has(signature)) continue;
    seen.add(signature);
    pool.push(candidate);
  }
  for (const shape of rng.shuffle(SHAPE_POOL)) {
    for (const color of rng.shuffle(COLOR_POOL)) {
      if (pool.length >= optionCount - 1) break;
      const candidate = cell(shape, color);
      const signature = cellSignature(candidate);
      if (seen.has(signature)) continue;
      seen.add(signature);
      pool.push(candidate);
    }
  }

  const distractors = pool.slice(0, optionCount - 1);
  if (distractors.length < optionCount - 1) {
    throw new AmbiguousPuzzleError('shapePattern ran out of distractors');
  }

  const contents = [cellOption(plan.answer), ...distractors.map(cellOption)];

  return finalizePuzzle(
    {
      kind: 'shapePattern',
      difficulty,
      title: 'Shape Pattern',
      instruction: 'Which shape continues the pattern?',
      board: { kind: 'row', cells: [...plan.visible, hiddenCell()] },
      contents,
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: plan.description,
    },
    rng,
  );
}

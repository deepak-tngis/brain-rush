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

/** Shapes with no rotational symmetry, so every 45-degree step looks different. */
const SPIN_SHAPES: readonly ShapeName[] = ['arrow', 'flag', 'heart'];

type Variant = 'cycle' | 'dual' | 'spin';

const VARIANTS_BY_DIFFICULTY: Readonly<Record<Difficulty, readonly Variant[]>> = {
  easy: ['cycle'],
  medium: ['cycle', 'cycle', 'dual'],
  hard: ['cycle', 'dual', 'spin'],
  expert: ['dual', 'spin', 'cycle', 'dual'],
};

interface PatternPlan {
  readonly visible: readonly Cell[];
  readonly answer: Cell;
  /** Near-miss options, best first; padded with fresh glyphs if too short. */
  readonly distractors: readonly Cell[];
  readonly instruction: string;
  readonly explanation: string;
  /** Reading two rhythms or an angle takes longer than spotting a repeat. */
  readonly timeScale: number;
}

/** True when the row's only defensible periodic continuation is `answer`, or it has none. */
function combinedRowAgrees(visible: readonly Cell[], answer: Cell): boolean {
  const nexts = plausiblePeriodicNexts(visible.map(cellSignature));
  if (nexts.length > 1) return false;
  return nexts.length === 0 || nexts[0] === cellSignature(answer);
}

/**
 * One attribute cycling. The run shows the cycle at least twice before the gap,
 * and `plausiblePeriodicNexts` *proves* that only one continuation is
 * defensible before the puzzle is allowed out.
 */
function cyclePlan(rng: Rng, difficulty: Difficulty): PatternPlan | null {
  const period =
    difficulty === 'easy' ? rng.int(2, 3) : difficulty === 'medium' ? rng.int(3, 4) : rng.int(4, 5);
  const tailLength = rng.int(1, period - 1);
  const visibleLength = period * 2 + tailLength;

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

  const nexts = plausiblePeriodicNexts(visible.map(cellSignature));
  if (nexts.length !== 1 || nexts[0] !== cellSignature(answer)) return null;

  // Other members of the cycle make the sharpest distractors: they are all
  // visibly present, yet only one of them lands on the right beat.
  const answerSignature = cellSignature(answer);
  const distractors = rng
    .shuffle(cycle)
    .filter((candidate) => cellSignature(candidate) !== answerSignature);

  return {
    visible,
    answer,
    distractors,
    instruction: 'Which shape continues the pattern?',
    explanation: varyColor
      ? `The colours repeat every ${period} shapes.`
      : `The shapes repeat every ${period} steps.`,
    timeScale: 1,
  };
}

type Attribute = 'shape' | 'colour' | 'fill';

const ATTRIBUTE_PAIRS: ReadonlyArray<readonly [Attribute, Attribute]> = [
  ['shape', 'colour'],
  ['shape', 'fill'],
  ['colour', 'fill'],
];

const ATTRIBUTE_LABEL: Record<Attribute, string> = {
  shape: 'shapes',
  colour: 'colours',
  fill: 'fill',
};

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Two attributes cycling at *different* periods, so the row never simply
 * repeats and the player has to read each rhythm on its own. Each attribute's
 * stream is proven to have exactly one continuation, and the combined row is
 * checked not to contradict it.
 */
function dualPlan(rng: Rng, difficulty: Difficulty): PatternPlan | null {
  const pair = difficulty === 'medium' ? (['shape', 'colour'] as const) : rng.pick(ATTRIBUTE_PAIRS);
  const maxPeriod = difficulty === 'expert' ? 4 : 3;
  const periodOf = (attribute: Attribute): number =>
    !pair.includes(attribute) ? 1 : attribute === 'fill' ? 2 : rng.int(2, maxPeriod);

  const shapePeriod = periodOf('shape');
  const colorPeriod = periodOf('colour');
  const fillPeriod = periodOf('fill');
  const periods = [shapePeriod, colorPeriod, fillPeriod].filter((period) => period > 1);
  if (new Set(periods).size !== periods.length) return null;

  const shapes = rng.sample(SHAPE_POOL, shapePeriod);
  const colors = rng.sample(COLOR_POOL, colorPeriod);
  const fills = fillPeriod === 2 ? [true, false] : [true];

  const at = (index: number): Cell =>
    cell(shapes[index % shapes.length] as ShapeName, colors[index % colors.length] as GlyphColor, {
      filled: fills[index % fills.length] as boolean,
    });

  const visibleLength = 2 * Math.max(...periods) + rng.int(1, 2);
  const visible = Array.from({ length: visibleLength }, (_unused, index) => at(index));
  const answer = at(visibleLength);

  const streams: ReadonlyArray<readonly [boolean, string[], string]> = [
    [shapePeriod > 1, visible.map((item) => item.shape), answer.shape],
    [colorPeriod > 1, visible.map((item) => item.color), answer.color],
    [fillPeriod > 1, visible.map((item) => (item.filled ? 'f' : 'o')), answer.filled ? 'f' : 'o'],
  ];
  for (const [varies, stream, expected] of streams) {
    if (!varies) continue;
    const nexts = plausiblePeriodicNexts(stream);
    if (nexts.length !== 1 || nexts[0] !== expected) return null;
  }
  if (!combinedRowAgrees(visible, answer)) return null;

  // Every combination of the attributes in play, closest to the answer first:
  // right shape in the wrong colour is a far better wrong answer than a glyph
  // that never appeared.
  const answerSignature = cellSignature(answer);
  const shared = (candidate: Cell): number =>
    Number(candidate.shape === answer.shape) +
    Number(candidate.color === answer.color) +
    Number(candidate.filled === answer.filled);
  const pool: Cell[] = [];
  for (const shape of shapes) {
    for (const color of colors) {
      for (const filled of fills) {
        const candidate = cell(shape, color, { filled });
        if (cellSignature(candidate) !== answerSignature) pool.push(candidate);
      }
    }
  }
  const distractors = rng.shuffle(pool).sort((a, b) => shared(b) - shared(a));

  const [first, second] = pair;
  const periodLabel = (attribute: Attribute): number =>
    attribute === 'shape' ? shapePeriod : attribute === 'colour' ? colorPeriod : 2;
  return {
    visible,
    answer,
    distractors,
    instruction: `${capitalise(ATTRIBUTE_LABEL[first])} and ${ATTRIBUTE_LABEL[second]} each follow their own pattern. What comes next?`,
    explanation: `The ${ATTRIBUTE_LABEL[first]} repeat every ${periodLabel(first)} and the ${ATTRIBUTE_LABEL[second]} every ${periodLabel(second)}.`,
    timeScale: 1.25,
  };
}

function normaliseRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * One glyph turning by a fixed angle each step. The rule is arithmetic on the
 * angle rather than a repeat, so looking back N cells does not work.
 */
function spinPlan(rng: Rng, difficulty: Difficulty): PatternPlan | null {
  const shape = rng.pick(SPIN_SHAPES);
  const color = rng.pick(COLOR_POOL);
  const step = rng.pick([45, 90]) * (rng.bool(0.35) ? -1 : 1);
  const visibleLength = difficulty === 'expert' ? 5 : 4;
  const start = rng.int(0, 7) * 45;

  const rotationAt = (index: number): number => normaliseRotation(start + index * step);
  const visible = Array.from({ length: visibleLength }, (_unused, index) =>
    cell(shape, color, { rotation: rotationAt(index) }),
  );
  const answer = cell(shape, color, { rotation: rotationAt(visibleLength) });
  if (!combinedRowAgrees(visible, answer)) return null;

  // Standing still, overshooting, and turning the wrong way come first; the
  // remaining orientations fill in behind them.
  const priority = [
    rotationAt(visibleLength - 1),
    rotationAt(visibleLength + 1),
    normaliseRotation(answer.rotation - 2 * step),
  ];
  const others = rng.shuffle(Array.from({ length: 8 }, (_unused, index) => index * 45));
  const seen = new Set<number>([answer.rotation]);
  const distractors: Cell[] = [];
  for (const rotation of [...priority, ...others]) {
    if (seen.has(rotation)) continue;
    seen.add(rotation);
    distractors.push(cell(shape, color, { rotation }));
  }

  const direction = step > 0 ? 'clockwise' : 'anticlockwise';
  return {
    visible,
    answer,
    distractors,
    instruction: 'The shape keeps turning. Which comes next?',
    explanation: `Each step turns the ${shape} ${Math.abs(step)} degrees ${direction}.`,
    timeScale: 1.2,
  };
}

function buildPlan(rng: Rng, difficulty: Difficulty): PatternPlan | null {
  const variant = rng.pick(VARIANTS_BY_DIFFICULTY[difficulty]);
  if (variant === 'dual') return dualPlan(rng, difficulty);
  if (variant === 'spin') return spinPlan(rng, difficulty);
  return cyclePlan(rng, difficulty);
}

export function generateShapePattern(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  let plan: PatternPlan | null = null;
  for (let attempt = 0; attempt < 60 && plan === null; attempt += 1) {
    plan = buildPlan(rng, difficulty);
  }
  if (plan === null) {
    throw new AmbiguousPuzzleError('shapePattern could not find an unambiguous pattern');
  }

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const seen = new Set<string>([cellSignature(plan.answer)]);
  const pool: Cell[] = [];
  const offer = (candidate: Cell): void => {
    if (pool.length >= optionCount - 1) return;
    const signature = cellSignature(candidate);
    if (seen.has(signature)) return;
    seen.add(signature);
    pool.push(candidate);
  };
  for (const candidate of plan.distractors) offer(candidate);
  for (const shape of rng.shuffle(SHAPE_POOL)) {
    for (const color of rng.shuffle(COLOR_POOL)) offer(cell(shape, color));
  }
  if (pool.length < optionCount - 1) {
    throw new AmbiguousPuzzleError('shapePattern ran out of distractors');
  }

  const contents = [cellOption(plan.answer), ...pool.map(cellOption)];

  return finalizePuzzle(
    {
      kind: 'shapePattern',
      difficulty,
      title: 'Shape Pattern',
      instruction: plan.instruction,
      board: { kind: 'row', cells: [...plan.visible, hiddenCell()] },
      contents,
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, plan.timeScale),
      explanation: plan.explanation,
    },
    rng,
  );
}

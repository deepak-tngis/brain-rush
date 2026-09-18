import { baseTimeLimit, isHardOrAbove, optionCountFor } from '../difficulty';
import { cell, cellSignature, finalizePuzzle, gridOption } from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const SHAPES: readonly ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'hexagon', 'cross'];
const COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal', 'red', 'yellow'];

/** Colour pairs that are close enough to demand a real second look. */
const CLOSE_COLOR_PAIRS: ReadonlyArray<readonly [GlyphColor, GlyphColor]> = [
  ['blue', 'teal'],
  ['pink', 'red'],
  ['orange', 'yellow'],
  ['purple', 'pink'],
];

type Tweak = 'shape' | 'colour' | 'rotation' | 'fill';

function tweakFor(rng: Rng, difficulty: Difficulty): Tweak {
  if (difficulty === 'easy') return 'shape';
  if (difficulty === 'medium') return rng.pick(['shape', 'colour'] as const);
  return rng.pick(['colour', 'rotation', 'fill'] as const);
}

function applyTweak(rng: Rng, source: Cell, tweak: Tweak): Cell {
  switch (tweak) {
    case 'shape': {
      const replacement = rng.pick(SHAPES.filter((shape) => shape !== source.shape));
      return { ...source, shape: replacement };
    }
    case 'colour': {
      const pair = CLOSE_COLOR_PAIRS.find((candidate) => candidate.includes(source.color));
      if (pair) {
        const other = pair[0] === source.color ? pair[1] : pair[0];
        return { ...source, color: other };
      }
      return { ...source, color: rng.pick(COLORS.filter((color) => color !== source.color)) };
    }
    case 'rotation':
      // 30 and 45 degrees are not multiples of any of our shapes' symmetry
      // angles (90 for squares/crosses, 60 for hexagons, 72 for stars, 120 for
      // triangles), so the tilt is always actually visible.
      return { ...source, rotation: (source.rotation + rng.pick([30, 45])) % 360 };
    case 'fill':
      return { ...source, filled: !source.filled };
    default:
      return source;
  }
}

const TWEAK_LABEL: Record<Tweak, string> = {
  shape: 'one shape is different',
  colour: 'one shape has a different colour',
  rotation: 'one shape is tilted',
  fill: 'one shape is not filled in the same way',
};

/**
 * All tiles but one are byte-identical; the answer is the single tile carrying a
 * one-cell change. `uniqueness: 'singleOutlier'` makes `finalizePuzzle` verify
 * exactly that shape of option set — two odd tiles, or none, is a hard failure.
 */
export function generateWhichIsDifferent(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const cols = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 2 : 3;
  const rows = isHardOrAbove(difficulty) ? 3 : 2;
  const size = cols * rows;
  const optionCount = optionCountFor(difficulty, 4, 6, 6);
  const tweak = tweakFor(rng, difficulty);

  // Build one tile, then decide which of its cells the odd tile changes.
  const shapePool = tweak === 'rotation' ? SHAPES.filter((shape) => shape !== 'circle') : SHAPES;
  const baseTile: Cell[] = Array.from({ length: size }, () => {
    const color =
      tweak === 'colour'
        ? rng.pick(CLOSE_COLOR_PAIRS.map((pair) => pair[0]))
        : rng.pick(COLORS);
    return cell(rng.pick(shapePool), color, { scale: 0.9 });
  });

  // A rotated circle is indistinguishable from an unrotated one, so the tweaked
  // cell has to be one where the change can actually be seen.
  const tweakable = baseTile
    .map((_unused, index) => index)
    .filter((index) => tweak !== 'rotation' || (baseTile[index] as Cell).shape !== 'circle');

  let oddTile: Cell[] = baseTile;
  for (const index of rng.shuffle(tweakable)) {
    const candidate = baseTile.slice();
    candidate[index] = applyTweak(rng, baseTile[index] as Cell, tweak);
    if (cellSignature(candidate[index] as Cell) !== cellSignature(baseTile[index] as Cell)) {
      oddTile = candidate;
      break;
    }
  }

  const answerIndex = rng.int(0, optionCount - 1);
  const contents = Array.from({ length: optionCount }, (_unused, index) =>
    gridOption(cols, index === answerIndex ? oddTile : baseTile),
  );

  return finalizePuzzle(
    {
      kind: 'whichIsDifferent',
      difficulty,
      title: 'Which Is Different?',
      instruction: 'One of these is not like the others',
      board: { kind: 'none' },
      contents,
      answerIndex,
      timeLimitMs: baseTimeLimit(difficulty, 1.2),
      explanation: `Every tile is identical except one: ${TWEAK_LABEL[tweak]}.`,
      uniqueness: 'singleOutlier',
    },
    rng,
  );
}

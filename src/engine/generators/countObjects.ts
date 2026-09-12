import { baseTimeLimit, optionCountFor } from '../difficulty';
import {
  cell,
  finalizePuzzle,
  numericDistractors,
  scatterLayout,
  textOption,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const SHAPES: readonly ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'hexagon'];
const DISTINCT_COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green'];
const CLOSE_COLORS: readonly GlyphColor[] = ['blue', 'teal', 'purple', 'pink'];

const SHAPE_PLURALS: Record<string, string> = {
  circle: 'circles',
  square: 'squares',
  triangle: 'triangles',
  diamond: 'diamonds',
  star: 'stars',
  heart: 'hearts',
  hexagon: 'hexagons',
};

interface Config {
  readonly total: number;
  readonly typeCount: number;
  readonly columns: number;
  readonly rows: number;
}

function configFor(rng: Rng, difficulty: Difficulty): Config {
  if (difficulty === 'easy') return { total: rng.int(6, 9), typeCount: 2, columns: 4, rows: 3 };
  if (difficulty === 'medium') return { total: rng.int(11, 15), typeCount: 3, columns: 5, rows: 4 };
  return { total: rng.int(16, 20), typeCount: 4, columns: 6, rows: 4 };
}

export function generateCountObjects(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const config = configFor(rng, difficulty);
  // Counting by shape is easier to verify at a glance than counting by colour,
  // so colour-counting is reserved for the harder bands.
  const countBy: 'shape' | 'color' = difficulty === 'easy' ? 'shape' : rng.pick(['shape', 'color'] as const);

  const shapes = rng.sample(SHAPES, config.typeCount);
  const palette = difficulty === 'hard' ? CLOSE_COLORS : DISTINCT_COLORS;
  const colors = rng.sample(palette, Math.min(config.typeCount, palette.length));

  // Split the total across the types, guaranteeing every type is present at
  // least twice so the target count is never trivially 0 or 1.
  const counts: number[] = new Array(config.typeCount).fill(2);
  let remaining = config.total - 2 * config.typeCount;
  while (remaining > 0) {
    const index = rng.int(0, config.typeCount - 1);
    counts[index] = (counts[index] as number) + 1;
    remaining -= 1;
  }

  const cells: Cell[] = [];
  for (let type = 0; type < config.typeCount; type += 1) {
    for (let i = 0; i < (counts[type] as number); i += 1) {
      const shape = countBy === 'shape' ? (shapes[type] as ShapeName) : rng.pick(shapes);
      const color =
        countBy === 'color'
          ? (colors[type % colors.length] as GlyphColor)
          : rng.pick(colors as readonly GlyphColor[]);
      cells.push(cell(shape, color, { scale: 0.85 }));
    }
  }

  const targetType = rng.int(0, config.typeCount - 1);
  const targetShape = shapes[targetType] as ShapeName;
  const targetColor = colors[targetType % colors.length] as GlyphColor;

  // Count from the rendered board rather than trusting the split — the board is
  // the only thing the player can see, so it is the only honest source of truth.
  const answer = cells.filter((item) =>
    countBy === 'shape' ? item.shape === targetShape : item.color === targetColor,
  ).length;

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const distractors = numericDistractors(rng, answer, optionCount - 1, Math.max(3, Math.round(answer * 0.8)), {
    reject: (value) => value < 1 || value > config.total + 3,
  });

  const scattered = scatterLayout(rng, rng.shuffle(cells), config.columns, config.rows);
  const label = countBy === 'shape' ? SHAPE_PLURALS[targetShape] ?? `${targetShape}s` : `${targetColor} shapes`;

  return finalizePuzzle(
    {
      kind: 'countObjects',
      difficulty,
      title: 'Count Objects',
      instruction: `How many ${label} are there?`,
      board: { kind: 'scatter', cells: scattered },
      contents: [textOption(String(answer)), ...distractors.map((v) => textOption(String(v)))],
      answerIndex: 0,
      // Counting needs scanning time even when the band is fast.
      timeLimitMs: baseTimeLimit(difficulty, 1.25),
      explanation: `There are exactly ${answer} ${label}.`,
    },
    rng,
  );
}

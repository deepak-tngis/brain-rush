import { baseTimeLimit, optionCountFor } from '../difficulty';
import type { Rng } from '../rng';
import { cell, cellOption, finalizePuzzle, textOption } from '../puzzleKit';
import type { Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

/**
 * Word banks are curated so that no word belongs to two categories — that is
 * what makes the odd one out *provably* odd rather than merely likely.
 */
const CATEGORIES: ReadonlyArray<{ readonly name: string; readonly words: readonly string[] }> = [
  { name: 'animals', words: ['Dog', 'Cat', 'Horse', 'Tiger', 'Rabbit', 'Elephant', 'Monkey', 'Zebra'] },
  { name: 'fruits', words: ['Apple', 'Banana', 'Mango', 'Grape', 'Cherry', 'Peach', 'Pear', 'Plum'] },
  { name: 'furniture', words: ['Chair', 'Table', 'Sofa', 'Desk', 'Shelf', 'Bed', 'Stool', 'Wardrobe'] },
  { name: 'colours', words: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Brown', 'Black'] },
  { name: 'vehicles', words: ['Bus', 'Train', 'Truck', 'Bicycle', 'Scooter', 'Tractor', 'Ferry', 'Van'] },
  { name: 'body parts', words: ['Elbow', 'Ankle', 'Shoulder', 'Wrist', 'Knee', 'Thumb', 'Chin', 'Heel'] },
  { name: 'instruments', words: ['Guitar', 'Piano', 'Violin', 'Flute', 'Drum', 'Trumpet', 'Harp', 'Cello'] },
  { name: 'metals', words: ['Iron', 'Copper', 'Silver', 'Gold', 'Zinc', 'Nickel', 'Tin', 'Lead'] },
  { name: 'planets', words: ['Mars', 'Venus', 'Jupiter', 'Saturn', 'Neptune', 'Uranus', 'Pluto', 'Earth'] },
  { name: 'weather', words: ['Rain', 'Snow', 'Fog', 'Hail', 'Thunder', 'Breeze', 'Drizzle', 'Storm'] },
  { name: 'sports', words: ['Tennis', 'Hockey', 'Cricket', 'Boxing', 'Rugby', 'Golf', 'Judo', 'Rowing'] },
  { name: 'jobs', words: ['Doctor', 'Baker', 'Pilot', 'Farmer', 'Teacher', 'Plumber', 'Chef', 'Nurse'] },
];

const DISTINCT_SHAPES: readonly ShapeName[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'heart',
  'cross',
  'hexagon',
];

/** Shapes that look alike, used to make the hard band genuinely deceptive. */
const SIMILAR_SHAPE_PAIRS: ReadonlyArray<readonly [ShapeName, ShapeName]> = [
  ['pentagon', 'hexagon'],
  ['square', 'diamond'],
  ['circle', 'hexagon'],
];

const HIGH_CONTRAST_COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green'];
const ALL_COLORS: readonly GlyphColor[] = [
  'blue',
  'orange',
  'pink',
  'green',
  'purple',
  'yellow',
  'teal',
  'red',
];

function wordPuzzle(rng: Rng, difficulty: Difficulty, count: number): PuzzleDraft {
  const [groupCategory, oddCategory] = rng.sample(CATEGORIES, 2) as [
    (typeof CATEGORIES)[number],
    (typeof CATEGORIES)[number],
  ];
  const groupWords = rng.sample(groupCategory.words, count - 1);
  const oddWord = rng.pick(oddCategory.words);

  const contents = [...groupWords.map(textOption), textOption(oddWord)];

  return finalizePuzzle(
    {
      kind: 'oddOneOut',
      difficulty,
      title: 'Odd One Out',
      instruction: 'Tap the word that does not belong',
      board: { kind: 'none' },
      contents,
      answerIndex: contents.length - 1,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: `Every other word names ${
        groupCategory.name === 'colours' ? 'a colour' : `a ${singular(groupCategory.name)}`
      }. "${oddWord}" does not.`,
      optionLayout: 'grid',
    },
    rng,
  );
}

function singular(categoryName: string): string {
  if (categoryName === 'body parts') return 'body part';
  if (categoryName === 'sports') return 'sport';
  return categoryName.replace(/s$/, '');
}

/**
 * Visual variants always vary one attribute across *all* items so that it
 * cannot single anybody out, then break a second attribute for exactly one
 * item. That construction leaves precisely one defensible answer.
 */
function visualPuzzle(rng: Rng, difficulty: Difficulty, count: number): PuzzleDraft {
  const mode = difficulty === 'hard' ? rng.pick(['shape', 'fill'] as const) : rng.pick(['colour', 'shape'] as const);

  if (mode === 'colour') {
    // Distinct shape per item (so shape identifies nobody), one colour breaks.
    const shapes = rng.sample(DISTINCT_SHAPES, count);
    const palette = difficulty === 'easy' ? HIGH_CONTRAST_COLORS : ALL_COLORS;
    const [shared, odd] = rng.sample(palette, 2) as [GlyphColor, GlyphColor];
    const contents = shapes.map((shape, index) =>
      cellOption(cell(shape, index === count - 1 ? odd : shared)),
    );
    return finalizePuzzle(
      {
        kind: 'oddOneOut',
        difficulty,
        title: 'Odd One Out',
        instruction: 'Tap the shape that does not belong',
        board: { kind: 'none' },
        contents,
        answerIndex: count - 1,
        timeLimitMs: baseTimeLimit(difficulty),
        explanation: `Every other shape is ${shared}. Only one is ${odd}.`,
      },
      rng,
    );
  }

  if (mode === 'shape') {
    // Distinct colour per item, one shape breaks.
    const colors = rng.sample(ALL_COLORS, count);
    const [shared, odd] =
      difficulty === 'hard'
        ? rng.pick(SIMILAR_SHAPE_PAIRS)
        : (rng.sample(DISTINCT_SHAPES, 2) as [ShapeName, ShapeName]);
    const contents = colors.map((color, index) =>
      cellOption(cell(index === count - 1 ? odd : shared, color)),
    );
    return finalizePuzzle(
      {
        kind: 'oddOneOut',
        difficulty,
        title: 'Odd One Out',
        instruction: 'Tap the shape that does not belong',
        board: { kind: 'none' },
        contents,
        answerIndex: count - 1,
        timeLimitMs: baseTimeLimit(difficulty),
        explanation: `Every other item is a ${shared}. Only one is a ${odd}.`,
      },
      rng,
    );
  }

  // fill: every item has its own shape *and* colour, one is hollow.
  const shapes = rng.sample(DISTINCT_SHAPES, count);
  const colors = rng.sample(ALL_COLORS, count);
  const hollowFirst = rng.bool();
  const contents = shapes.map((shape, index) =>
    cellOption(
      cell(shape, colors[index] as GlyphColor, {
        filled: index === count - 1 ? !hollowFirst : hollowFirst,
      }),
    ),
  );
  return finalizePuzzle(
    {
      kind: 'oddOneOut',
      difficulty,
      title: 'Odd One Out',
      instruction: 'Tap the shape that does not belong',
      board: { kind: 'none' },
      contents,
      answerIndex: count - 1,
      timeLimitMs: baseTimeLimit(difficulty),
      explanation: hollowFirst
        ? 'Every other shape is outlined. Only one is solid.'
        : 'Every other shape is solid. Only one is outlined.',
    },
    rng,
  );
}

export function generateOddOneOut(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const count = optionCountFor(difficulty, 4, 5, 6);
  // Words read fast and give the mode variety; shapes carry the visual identity.
  return rng.bool(difficulty === 'hard' ? 0.35 : 0.5)
    ? wordPuzzle(rng, difficulty, count)
    : visualPuzzle(rng, difficulty, count);
}

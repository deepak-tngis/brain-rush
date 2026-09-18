import { baseTimeLimit, isHardOrAbove, optionCountFor } from '../difficulty';
import type { Rng } from '../rng';
import { cell, cellOption, finalizePuzzle, textOption } from '../puzzleKit';
import type { Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

export interface WordCategory {
  readonly name: string;
  /** What one member is called in the explanation. */
  readonly singular: string;
  /**
   * Categories in the same group share an obvious umbrella ("animals"), so
   * an odd word drawn from a sibling is a fair but genuinely harder ask —
   * reserved for the hard bands.
   */
  readonly group: string;
  readonly words: readonly string[];
}

/**
 * Word banks are curated so that no word belongs to two categories — that is
 * what makes the odd one out *provably* odd rather than merely likely. The
 * test suite checks the banks stay disjoint.
 */
export const CATEGORIES: readonly WordCategory[] = [
  { name: 'mammals', singular: 'a mammal', group: 'creatures', words: ['Dog', 'Cat', 'Horse', 'Tiger', 'Rabbit', 'Elephant', 'Monkey', 'Zebra'] },
  { name: 'birds', singular: 'a bird', group: 'creatures', words: ['Eagle', 'Sparrow', 'Parrot', 'Owl', 'Penguin', 'Swan', 'Crow', 'Robin'] },
  { name: 'sea creatures', singular: 'a sea creature', group: 'creatures', words: ['Shark', 'Whale', 'Dolphin', 'Octopus', 'Crab', 'Squid', 'Seal', 'Jellyfish'] },
  { name: 'insects', singular: 'an insect', group: 'creatures', words: ['Ant', 'Bee', 'Wasp', 'Beetle', 'Moth', 'Ladybird', 'Dragonfly', 'Termite'] },
  { name: 'fruits', singular: 'a fruit', group: 'food', words: ['Apple', 'Banana', 'Mango', 'Grape', 'Cherry', 'Peach', 'Pear', 'Plum'] },
  { name: 'vegetables', singular: 'a vegetable', group: 'food', words: ['Carrot', 'Onion', 'Potato', 'Cabbage', 'Spinach', 'Broccoli', 'Turnip', 'Leek'] },
  { name: 'drinks', singular: 'a drink', group: 'food', words: ['Tea', 'Coffee', 'Juice', 'Milk', 'Water', 'Lemonade', 'Cocoa', 'Cider'] },
  { name: 'furniture', singular: 'a piece of furniture', group: 'home', words: ['Chair', 'Table', 'Sofa', 'Desk', 'Shelf', 'Bed', 'Stool', 'Wardrobe'] },
  { name: 'kitchen items', singular: 'a kitchen item', group: 'home', words: ['Spoon', 'Fork', 'Knife', 'Plate', 'Bowl', 'Kettle', 'Pan', 'Whisk'] },
  { name: 'rooms', singular: 'a room', group: 'home', words: ['Kitchen', 'Bedroom', 'Bathroom', 'Attic', 'Cellar', 'Garage', 'Hallway', 'Lounge'] },
  { name: 'colours', singular: 'a colour', group: 'abstract', words: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Brown', 'Black'] },
  { name: 'vehicles', singular: 'a vehicle', group: 'objects', words: ['Bus', 'Train', 'Truck', 'Bicycle', 'Scooter', 'Tractor', 'Ferry', 'Van'] },
  { name: 'tools', singular: 'a tool', group: 'objects', words: ['Hammer', 'Wrench', 'Saw', 'Drill', 'Pliers', 'Chisel', 'Spanner', 'Screwdriver'] },
  { name: 'clothing', singular: 'an item of clothing', group: 'objects', words: ['Shirt', 'Jacket', 'Scarf', 'Gloves', 'Trousers', 'Skirt', 'Coat', 'Socks'] },
  { name: 'instruments', singular: 'an instrument', group: 'objects', words: ['Guitar', 'Piano', 'Violin', 'Flute', 'Drum', 'Trumpet', 'Harp', 'Cello'] },
  { name: 'body parts', singular: 'a body part', group: 'body', words: ['Elbow', 'Ankle', 'Shoulder', 'Wrist', 'Knee', 'Thumb', 'Chin', 'Heel'] },
  { name: 'metals', singular: 'a metal', group: 'nature', words: ['Iron', 'Copper', 'Silver', 'Gold', 'Zinc', 'Nickel', 'Tin', 'Lead'] },
  { name: 'planets', singular: 'a planet', group: 'nature', words: ['Mars', 'Venus', 'Jupiter', 'Saturn', 'Neptune', 'Uranus', 'Mercury', 'Earth'] },
  { name: 'weather', singular: 'a kind of weather', group: 'nature', words: ['Rain', 'Snow', 'Fog', 'Hail', 'Thunder', 'Breeze', 'Drizzle', 'Storm'] },
  { name: 'trees', singular: 'a tree', group: 'nature', words: ['Oak', 'Pine', 'Maple', 'Birch', 'Willow', 'Cedar', 'Elm', 'Palm'] },
  { name: 'flowers', singular: 'a flower', group: 'nature', words: ['Rose', 'Tulip', 'Daisy', 'Lily', 'Orchid', 'Sunflower', 'Poppy', 'Iris'] },
  { name: 'sports', singular: 'a sport', group: 'activities', words: ['Tennis', 'Hockey', 'Cricket', 'Boxing', 'Rugby', 'Golf', 'Judo', 'Rowing'] },
  { name: 'jobs', singular: 'a job', group: 'activities', words: ['Doctor', 'Baker', 'Pilot', 'Farmer', 'Teacher', 'Plumber', 'Chef', 'Nurse'] },
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

/** Colour pairs close enough that the odd one needs a second look. */
const CLOSE_COLOR_PAIRS: ReadonlyArray<readonly [GlyphColor, GlyphColor]> = [
  ['blue', 'teal'],
  ['pink', 'red'],
  ['orange', 'yellow'],
  ['purple', 'pink'],
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
  const groupCategory = rng.pick(CATEGORIES);
  // Hard bands may draw the odd word from a sibling category (a bird among
  // mammals); easier ones keep the contrast obvious.
  const siblings = CATEGORIES.filter(
    (category) => category !== groupCategory && category.group === groupCategory.group,
  );
  const strangers = CATEGORIES.filter((category) => category.group !== groupCategory.group);
  const useSibling = isHardOrAbove(difficulty) && siblings.length > 0 && rng.bool(0.6);
  const oddCategory = rng.pick(useSibling ? siblings : strangers);

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
      explanation: `Every other word names ${groupCategory.singular}. "${oddWord}" is ${oddCategory.singular}.`,
      optionLayout: 'grid',
    },
    rng,
  );
}

type VisualMode = 'colour' | 'shape' | 'fill';

function visualModeFor(rng: Rng, difficulty: Difficulty): VisualMode {
  if (difficulty === 'expert') return rng.pick(['shape', 'fill', 'colour'] as const);
  if (difficulty === 'hard') return rng.pick(['shape', 'fill'] as const);
  return rng.pick(['colour', 'shape'] as const);
}

/**
 * Visual variants always vary one attribute across *all* items so that it
 * cannot single anybody out, then break a second attribute for exactly one
 * item. That construction leaves precisely one defensible answer.
 */
function visualPuzzle(rng: Rng, difficulty: Difficulty, count: number): PuzzleDraft {
  const mode = visualModeFor(rng, difficulty);

  if (mode === 'colour') {
    // Distinct shape per item (so shape identifies nobody), one colour breaks.
    const shapes = rng.sample(DISTINCT_SHAPES, count);
    const palette = difficulty === 'easy' ? HIGH_CONTRAST_COLORS : ALL_COLORS;
    const [shared, odd] = (
      difficulty === 'expert' ? rng.shuffle(rng.pick(CLOSE_COLOR_PAIRS)) : rng.sample(palette, 2)
    ) as [GlyphColor, GlyphColor];
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
    const [shared, odd] = (
      isHardOrAbove(difficulty)
        ? rng.shuffle(rng.pick(SIMILAR_SHAPE_PAIRS))
        : rng.sample(DISTINCT_SHAPES, 2)
    ) as [ShapeName, ShapeName];
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
  return rng.bool(isHardOrAbove(difficulty) ? 0.4 : 0.5)
    ? wordPuzzle(rng, difficulty, count)
    : visualPuzzle(rng, difficulty, count);
}

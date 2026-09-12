import { baseTimeLimit } from '../difficulty';
import {
  AmbiguousPuzzleError,
  cell,
  cellOption,
  cellSignature,
  finalizePuzzle,
  textOption,
} from '../puzzleKit';
import type { Rng } from '../rng';
import type { Cell, Difficulty, GlyphColor, PuzzleDraft, ShapeName } from '../types';

const SHAPES: readonly ShapeName[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'heart',
  'hexagon',
  'cross',
];
const COLORS: readonly GlyphColor[] = ['blue', 'orange', 'pink', 'green', 'purple', 'teal', 'red', 'yellow'];

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'] as const;

interface Config {
  readonly itemCount: number;
  readonly studyMs: number;
}

function configFor(difficulty: Difficulty): Config {
  if (difficulty === 'easy') return { itemCount: 3, studyMs: 2600 };
  if (difficulty === 'medium') return { itemCount: 4, studyMs: 2200 };
  return { itemCount: 5, studyMs: 1800 };
}

/** Distinct in *both* shape and colour, so no two studied items look alike. */
function distinctCells(rng: Rng, count: number): Cell[] {
  if (count > Math.min(SHAPES.length, COLORS.length)) {
    throw new AmbiguousPuzzleError('memory needs more distinct glyphs than exist');
  }
  const shapes = rng.sample(SHAPES, count);
  const colors = rng.sample(COLORS, count);
  return shapes.map((shape, index) => cell(shape, colors[index] as GlyphColor));
}

/** "Which shape was in position N?" — the studied row is its own distractor pool. */
function positionPuzzle(rng: Rng, difficulty: Difficulty, config: Config): PuzzleDraft {
  const studied = distinctCells(rng, config.itemCount);
  const targetIndex = rng.int(0, studied.length - 1);
  const answer = studied[targetIndex] as Cell;

  const seen = new Set<string>([cellSignature(answer)]);
  const distractors: Cell[] = [];
  for (const candidate of rng.shuffle(studied)) {
    if (distractors.length >= 3) break;
    const signature = cellSignature(candidate);
    if (seen.has(signature)) continue;
    seen.add(signature);
    distractors.push(candidate);
  }
  // Pad with unseen glyphs when the studied row is short.
  for (const shape of rng.shuffle(SHAPES)) {
    if (distractors.length >= 3) break;
    for (const color of rng.shuffle(COLORS)) {
      if (distractors.length >= 3) break;
      const candidate = cell(shape, color);
      const signature = cellSignature(candidate);
      if (seen.has(signature)) continue;
      seen.add(signature);
      distractors.push(candidate);
    }
  }

  return finalizePuzzle(
    {
      kind: 'memory',
      difficulty,
      title: 'Memory',
      instruction: `Which shape was in the ${ORDINALS[targetIndex]} position?`,
      board: { kind: 'none' },
      contents: [cellOption(answer), ...distractors.map(cellOption)],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, 1.1),
      explanation: `The ${ORDINALS[targetIndex]} shape was a ${answer.color} ${answer.shape}.`,
      memory: {
        board: { kind: 'row', cells: studied },
        studyMs: config.studyMs,
        studyPrompt: 'Remember the order',
      },
    },
    rng,
  );
}

/** "Which one did you see?" — exactly one option is drawn from the studied set. */
function presencePuzzle(rng: Rng, difficulty: Difficulty, config: Config): PuzzleDraft {
  const studied = distinctCells(rng, config.itemCount);
  const answer = rng.pick(studied);
  const studiedSignatures = new Set(studied.map(cellSignature));

  const seen = new Set<string>([cellSignature(answer)]);
  const distractors: Cell[] = [];
  for (const shape of rng.shuffle(SHAPES)) {
    for (const color of rng.shuffle(COLORS)) {
      if (distractors.length >= 3) break;
      const candidate = cell(shape, color);
      const signature = cellSignature(candidate);
      // Never offer a second glyph that was actually on screen.
      if (seen.has(signature) || studiedSignatures.has(signature)) continue;
      seen.add(signature);
      distractors.push(candidate);
    }
    if (distractors.length >= 3) break;
  }
  if (distractors.length < 3) {
    throw new AmbiguousPuzzleError('memory presence ran out of unseen glyphs');
  }

  return finalizePuzzle(
    {
      kind: 'memory',
      difficulty,
      title: 'Memory',
      instruction: 'Which one did you just see?',
      board: { kind: 'none' },
      contents: [cellOption(answer), ...distractors.map(cellOption)],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, 1.1),
      explanation: `Only the ${answer.color} ${answer.shape} was on screen.`,
      memory: {
        board: { kind: 'row', cells: studied },
        studyMs: config.studyMs,
        studyPrompt: 'Remember these shapes',
      },
    },
    rng,
  );
}

/** Hard variant: recall a short digit string. */
function digitsPuzzle(rng: Rng, difficulty: Difficulty, config: Config): PuzzleDraft {
  const length = difficulty === 'hard' ? 5 : 4;
  const digits = Array.from({ length }, () => rng.int(0, 9)).join('');

  const seen = new Set<string>([digits]);
  const distractors: string[] = [];
  for (let attempt = 0; attempt < 200 && distractors.length < 3; attempt += 1) {
    // Swap or nudge a single digit: close enough to require real recall.
    const index = rng.int(0, length - 1);
    const chars = digits.split('');
    const delta = rng.bool() ? 1 : -1;
    chars[index] = String((Number(chars[index]) + delta + 10) % 10);
    const candidate = chars.join('');
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    distractors.push(candidate);
  }
  if (distractors.length < 3) {
    throw new AmbiguousPuzzleError('memory digits ran out of distractors');
  }

  return finalizePuzzle(
    {
      kind: 'memory',
      difficulty,
      title: 'Memory',
      instruction: 'Which number did you see?',
      board: { kind: 'none' },
      contents: [textOption(digits), ...distractors.map(textOption)],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, 1.1),
      explanation: `The number was ${digits}.`,
      memory: {
        board: { kind: 'text', text: digits },
        studyMs: config.studyMs,
        studyPrompt: 'Remember this number',
      },
    },
    rng,
  );
}

export function generateMemory(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const config = configFor(difficulty);
  const variant =
    difficulty === 'easy'
      ? rng.pick(['position', 'presence'] as const)
      : rng.pick(['position', 'presence', 'digits'] as const);

  if (variant === 'position') return positionPuzzle(rng, difficulty, config);
  if (variant === 'presence') return presencePuzzle(rng, difficulty, config);
  return digitsPuzzle(rng, difficulty, config);
}

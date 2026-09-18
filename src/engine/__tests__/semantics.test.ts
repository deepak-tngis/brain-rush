import { GENERATORS } from '../generators';
import { CATEGORIES } from '../generators/oddOneOut';
import { cellSignature } from '../puzzleKit';
import { createRng, hashSeed } from '../rng';
import { predictNext } from '../numericRules';
import { DIFFICULTIES } from '../types';
import type { Cell, Difficulty, PuzzleDraft, PuzzleKind } from '../types';

/**
 * These tests re-derive each puzzle's answer from the board the player actually
 * sees, using logic written independently of the generators. A generator that
 * silently drifted from what it renders would fail here even if its own internal
 * bookkeeping stayed self-consistent.
 */
const SEEDS = 120;

function generate(kind: PuzzleKind, difficulty: Difficulty, seed: number): PuzzleDraft {
  return GENERATORS[kind](createRng(hashSeed(kind, difficulty, seed)), difficulty);
}

function forEachSeed(kind: PuzzleKind, check: (puzzle: PuzzleDraft, difficulty: Difficulty) => void): void {
  for (const difficulty of DIFFICULTIES) {
    for (let seed = 0; seed < SEEDS; seed += 1) {
      check(generate(kind, difficulty, seed), difficulty);
    }
  }
}

function answerText(puzzle: PuzzleDraft): string {
  const option = puzzle.options.find((candidate) => candidate.id === puzzle.answerId);
  if (option === undefined || option.content.kind !== 'text') {
    throw new Error(`${puzzle.kind} answer is not a text option`);
  }
  return option.content.text;
}

function answerCell(puzzle: PuzzleDraft): Cell {
  const option = puzzle.options.find((candidate) => candidate.id === puzzle.answerId);
  if (option === undefined || option.content.kind !== 'cell') {
    throw new Error(`${puzzle.kind} answer is not a cell option`);
  }
  return option.content.cell;
}

function answerGrid(puzzle: PuzzleDraft): readonly Cell[] {
  const option = puzzle.options.find((candidate) => candidate.id === puzzle.answerId);
  if (option === undefined || option.content.kind !== 'grid') {
    throw new Error(`${puzzle.kind} answer is not a grid option`);
  }
  return option.content.cells;
}

/** Minimal precedence-aware evaluator, written from scratch as a cross-check. */
function evaluateExpression(input: string): number {
  const tokens = input.replace(/x/g, '*').match(/\d+|[+\-*/()]/g) ?? [];
  let position = 0;

  const peek = (): string | undefined => tokens[position];

  const parseFactor = (): number => {
    const token = tokens[position];
    if (token === '(') {
      position += 1;
      const value = parseSum();
      position += 1; // closing paren
      return value;
    }
    position += 1;
    return Number(token);
  };

  const parseProduct = (): number => {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const operator = tokens[position];
      position += 1;
      const right = parseFactor();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  function parseSum(): number {
    let value = parseProduct();
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[position];
      position += 1;
      const right = parseProduct();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  return parseSum();
}

describe('Quick Math', () => {
  it('offers the value the printed expression actually evaluates to', () => {
    forEachSeed('quickMath', (puzzle) => {
      if (puzzle.board.kind !== 'text') throw new Error('expected a text board');
      const expression = puzzle.board.text.replace(/\s*=\s*\?$/, '');
      expect(Number(answerText(puzzle))).toBe(evaluateExpression(expression));
    });
  });

  it('never offers a second option that also evaluates correctly', () => {
    forEachSeed('quickMath', (puzzle) => {
      if (puzzle.board.kind !== 'text') throw new Error('expected a text board');
      const value = evaluateExpression(puzzle.board.text.replace(/\s*=\s*\?$/, ''));
      const correct = puzzle.options.filter(
        (option) => option.content.kind === 'text' && Number(option.content.text) === value,
      );
      expect(correct).toHaveLength(1);
    });
  });
});

describe('Number Sequence', () => {
  it('offers the continuation the rule universe derives from the visible terms', () => {
    forEachSeed('numberSequence', (puzzle) => {
      if (puzzle.board.kind !== 'row') throw new Error('expected a row board');
      const terms = puzzle.board.cells
        .filter((item) => item.hidden !== true)
        .map((item) => Number(item.label));
      expect(predictNext(terms)).toEqual([Number(answerText(puzzle))]);
    });
  });

  it('never offers a second option the rules would also accept', () => {
    forEachSeed('numberSequence', (puzzle) => {
      if (puzzle.board.kind !== 'row') throw new Error('expected a row board');
      const terms = puzzle.board.cells
        .filter((item) => item.hidden !== true)
        .map((item) => Number(item.label));
      const legal = puzzle.options.filter(
        (option) =>
          option.content.kind === 'text' && predictNext(terms).includes(Number(option.content.text)),
      );
      expect(legal).toHaveLength(1);
    });
  });
});

describe('Count Objects', () => {
  it('offers the count that is actually on the board', () => {
    forEachSeed('countObjects', (puzzle) => {
      if (puzzle.board.kind !== 'scatter') throw new Error('expected a scatter board');
      const match = /How many (\S+) (?:shapes )?are there\?/.exec(puzzle.instruction);
      expect(match).not.toBeNull();
      const target = (match as RegExpExecArray)[1] as string;

      const byShape = puzzle.board.cells.filter((item) => `${item.shape}s` === target).length;
      const byColor = puzzle.board.cells.filter((item) => item.color === target).length;
      const counted = puzzle.instruction.includes('shapes are there') ? byColor : byShape;

      expect(counted).toBeGreaterThan(0);
      expect(Number(answerText(puzzle))).toBe(counted);
    });
  });

  it('keeps every glyph inside the board area', () => {
    forEachSeed('countObjects', (puzzle) => {
      if (puzzle.board.kind !== 'scatter') throw new Error('expected a scatter board');
      for (const item of puzzle.board.cells) {
        expect(item.x).toBeGreaterThan(0);
        expect(item.x).toBeLessThan(1);
        expect(item.y).toBeGreaterThan(0);
        expect(item.y).toBeLessThan(1);
      }
    });
  });
});

/** Shortest period that the whole run repeats with, or its length if none. */
function shortestPeriod(stream: readonly string[]): number {
  for (let candidate = 1; candidate * 2 <= stream.length; candidate += 1) {
    const periodic = stream.every(
      (item, index) => index < candidate || item === stream[index - candidate],
    );
    if (periodic) return candidate;
  }
  return stream.length;
}

describe('Shape Pattern', () => {
  it('offers the shape that continues the visible cycle', () => {
    let checked = 0;
    forEachSeed('shapePattern', (puzzle) => {
      if (puzzle.board.kind !== 'row') throw new Error('expected a row board');
      if (!puzzle.instruction.startsWith('Which shape continues')) return;
      checked += 1;
      const visible = puzzle.board.cells.filter((item) => item.hidden !== true);
      const period = shortestPeriod(visible.map(cellSignature));
      const expected = visible[visible.length - period] as Cell;
      expect(cellSignature(answerCell(puzzle))).toBe(cellSignature(expected));
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('reads each attribute on its own rhythm when two patterns run together', () => {
    let checked = 0;
    forEachSeed('shapePattern', (puzzle) => {
      if (puzzle.board.kind !== 'row') throw new Error('expected a row board');
      if (!puzzle.instruction.includes('each follow their own pattern')) return;
      checked += 1;
      const visible = puzzle.board.cells.filter((item) => item.hidden !== true);
      const continuation = <T extends string>(stream: readonly T[]): T =>
        stream[stream.length - shortestPeriod(stream)] as T;
      const answer = answerCell(puzzle);
      expect(answer.shape).toBe(continuation(visible.map((item) => item.shape)));
      expect(answer.color).toBe(continuation(visible.map((item) => item.color)));
      expect(answer.filled ? 'f' : 'o').toBe(
        continuation(visible.map((item) => (item.filled ? 'f' : 'o'))),
      );
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('offers the next orientation when the glyph keeps turning', () => {
    let checked = 0;
    forEachSeed('shapePattern', (puzzle) => {
      if (puzzle.board.kind !== 'row') throw new Error('expected a row board');
      if (!puzzle.instruction.startsWith('The shape keeps turning')) return;
      checked += 1;
      const visible = puzzle.board.cells.filter((item) => item.hidden !== true);
      const last = visible[visible.length - 1] as Cell;
      const previous = visible[visible.length - 2] as Cell;
      const step = (((last.rotation - previous.rotation) % 360) + 360) % 360;
      // Every visible step must be the same turn, or the rule is not a rule.
      for (let i = 1; i < visible.length; i += 1) {
        const turn =
          ((((visible[i] as Cell).rotation - (visible[i - 1] as Cell).rotation) % 360) + 360) % 360;
        expect(turn).toBe(step);
      }
      expect(answerCell(puzzle).rotation).toBe((last.rotation + step) % 360);
      expect(answerCell(puzzle).shape).toBe(last.shape);
    });
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Colour Logic', () => {
  it('offers the only colour left unused as a result', () => {
    forEachSeed('colorLogic', (puzzle) => {
      if (puzzle.board.kind !== 'grid') throw new Error('expected a grid board');
      if (!puzzle.instruction.startsWith('Each colour')) return; // cycle variant

      const rows: Cell[][] = [];
      for (let i = 0; i < puzzle.board.cells.length; i += 3) {
        rows.push(puzzle.board.cells.slice(i, i + 3) as Cell[]);
      }
      const shownResults = rows
        .filter((row) => (row[2] as Cell).hidden !== true)
        .map((row) => (row[2] as Cell).color);
      const allColours = new Set(
        puzzle.options.flatMap((option) =>
          option.content.kind === 'cell' ? [option.content.cell.color] : [],
        ),
      );
      const unused = [...allColours].filter((colour) => !shownResults.includes(colour));

      expect(unused).toHaveLength(1);
      expect(answerCell(puzzle).color).toBe(unused[0]);
    });
  });

  it('offers the colour reached by walking the loop', () => {
    let cyclesChecked = 0;
    forEachSeed('colorLogic', (puzzle) => {
      if (puzzle.board.kind !== 'grid') throw new Error('expected a grid board');
      const match = /Where does (\w+) land after (\d+) steps\?/.exec(puzzle.instruction);
      if (match === null) return; // bijection variant
      cyclesChecked += 1;

      const [, start, stepText] = match as RegExpExecArray;
      const next = new Map<string, string>();
      for (let i = 0; i < puzzle.board.cells.length; i += 3) {
        next.set(
          (puzzle.board.cells[i] as Cell).color,
          (puzzle.board.cells[i + 2] as Cell).color,
        );
      }

      let position = start as string;
      for (let step = 0; step < Number(stepText); step += 1) {
        position = next.get(position) as string;
      }
      expect(answerCell(puzzle).color).toBe(position);
    });
    expect(cyclesChecked).toBeGreaterThan(0);
  });
});

describe('Spatial Reasoning', () => {
  it('offers the grid that is the board rotated as asked', () => {
    forEachSeed('spatialReasoning', (puzzle) => {
      if (puzzle.board.kind !== 'grid') return; // single-glyph variant
      const size = puzzle.board.cols;
      const board = puzzle.board.cells;

      const turns = puzzle.instruction.includes('half turn')
        ? 2
        : puzzle.instruction.includes('anticlockwise')
          ? 3
          : 1;

      let rotated = board.map((item) => item.filled);
      for (let turn = 0; turn < turns; turn += 1) {
        const next = new Array<boolean>(size * size).fill(false);
        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            next[col * size + (size - 1 - row)] = rotated[row * size + col] as boolean;
          }
        }
        rotated = next;
      }

      expect(answerGrid(puzzle).map((item) => item.filled)).toEqual(rotated);
    });
  });

  it('offers the glyph at the asked orientation', () => {
    forEachSeed('spatialReasoning', (puzzle) => {
      if (puzzle.board.kind !== 'row') return; // grid variant
      const source = puzzle.board.cells[0] as Cell;
      const turn = puzzle.instruction.includes('half turn')
        ? 180
        : puzzle.instruction.includes('anticlockwise')
          ? 270
          : 90;
      expect(answerCell(puzzle).rotation).toBe((source.rotation + turn) % 360);
      expect(answerCell(puzzle).shape).toBe(source.shape);
    });
  });
});

describe('Matching', () => {
  it('offers exactly one tile identical to the target', () => {
    forEachSeed('matching', (puzzle) => {
      if (puzzle.board.kind !== 'grid') throw new Error('expected a grid board');
      const target = puzzle.board.cells.map(cellSignature).join(',');
      const identical = puzzle.options.filter(
        (option) =>
          option.content.kind === 'grid' &&
          option.content.cells.map(cellSignature).join(',') === target,
      );
      expect(identical).toHaveLength(1);
      expect((identical[0] as (typeof identical)[number]).id).toBe(puzzle.answerId);
    });
  });
});

describe('Odd One Out', () => {
  it('keeps every word in exactly one category', () => {
    const owners = new Map<string, string>();
    for (const category of CATEGORIES) {
      for (const word of category.words) {
        const key = word.toLowerCase();
        expect(owners.get(key)).toBeUndefined();
        owners.set(key, category.name);
      }
    }
  });

  it('names the odd word in its explanation and never a group word', () => {
    forEachSeed('oddOneOut', (puzzle) => {
      if (puzzle.options[0]?.content.kind !== 'text') return;
      const answer = answerText(puzzle);
      expect(puzzle.explanation).toContain(`"${answer}"`);
      const groupWords = puzzle.options
        .filter((option) => option.id !== puzzle.answerId)
        .map((option) => (option.content.kind === 'text' ? option.content.text : ''));
      const groupCategory = CATEGORIES.find((category) => category.words.includes(groupWords[0] as string));
      expect(groupCategory).toBeDefined();
      for (const word of groupWords) expect(groupCategory?.words).toContain(word);
      expect(groupCategory?.words).not.toContain(answer);
    });
  });
});

describe('Memory', () => {
  it('always hides a study board behind the question', () => {
    forEachSeed('memory', (puzzle) => {
      expect(puzzle.memory).toBeDefined();
      const memory = puzzle.memory as NonNullable<typeof puzzle.memory>;
      expect(memory.studyMs).toBeGreaterThanOrEqual(1500);
      expect(memory.board.kind).not.toBe('none');
    });
  });

  it('shows nothing on the answer board that gives the answer away', () => {
    forEachSeed('memory', (puzzle) => {
      expect(puzzle.board.kind).toBe('none');
    });
  });
});

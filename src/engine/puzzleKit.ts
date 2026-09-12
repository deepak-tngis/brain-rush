import type { Rng } from './rng';
import type {
  Cell,
  Difficulty,
  GlyphColor,
  MemoryPhase,
  OptionContent,
  PuzzleBoard,
  PuzzleDraft,
  PuzzleKind,
  PuzzleOption,
  ScatterCell,
  ShapeName,
} from './types';

/**
 * Thrown when a generator would have produced a puzzle with zero or more than
 * one defensible answer. It is a programming error, not a runtime condition:
 * every generator resamples until its candidate passes, and the unit tests
 * exercise thousands of seeds to prove the resampling always converges.
 */
export class AmbiguousPuzzleError extends Error {
  constructor(message: string) {
    super(`Ambiguous puzzle rejected: ${message}`);
    this.name = 'AmbiguousPuzzleError';
  }
}

export function cell(shape: ShapeName, color: GlyphColor, overrides: Partial<Cell> = {}): Cell {
  return {
    shape,
    color,
    rotation: 0,
    filled: true,
    scale: 1,
    ...overrides,
  };
}

export function labelCell(label: string, color: GlyphColor = 'blue', overrides: Partial<Cell> = {}): Cell {
  return cell('blank', color, { label, ...overrides });
}

export const HIDDEN_CELL_LABEL = '?';

export function hiddenCell(color: GlyphColor = 'blue'): Cell {
  return cell('blank', color, { hidden: true, label: HIDDEN_CELL_LABEL });
}

export function operatorCell(symbol: string): Cell {
  return cell('blank', 'blue', { label: symbol, muted: true, scale: 0.8 });
}

/**
 * Canonical string form of a cell. Two cells that render identically must
 * produce the same signature — that is what makes the uniqueness check below
 * meaningful rather than decorative.
 */
export function cellSignature(value: Cell): string {
  const rotation = ((Math.round(value.rotation) % 360) + 360) % 360;
  return [
    value.shape,
    value.color,
    value.filled ? 'f' : 'o',
    rotation,
    value.scale.toFixed(2),
    value.label ?? '',
    value.hidden ? 'h' : '',
    value.muted ? 'm' : '',
  ].join('/');
}

export function optionSignature(content: OptionContent): string {
  switch (content.kind) {
    case 'text':
      return `text:${content.text.trim().toLowerCase()}`;
    case 'cell':
      return `cell:${cellSignature(content.cell)}`;
    case 'grid':
      return `grid:${content.cols}:${content.cells.map(cellSignature).join(',')}`;
    default: {
      const exhaustive: never = content;
      throw new Error(`Unhandled option content ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function textOption(text: string): OptionContent {
  return { kind: 'text', text };
}

export function cellOption(value: Cell): OptionContent {
  return { kind: 'cell', cell: value };
}

export function gridOption(cols: number, cells: readonly Cell[]): OptionContent {
  return { kind: 'grid', cols, cells };
}

export interface DraftInput {
  readonly kind: PuzzleKind;
  readonly difficulty: Difficulty;
  readonly title: string;
  readonly instruction: string;
  readonly board: PuzzleBoard;
  /** Option contents in generation order; the correct one is at `answerIndex`. */
  readonly contents: readonly OptionContent[];
  readonly answerIndex: number;
  readonly timeLimitMs: number;
  readonly explanation: string;
  readonly memory?: MemoryPhase;
  readonly optionLayout?: 'grid' | 'list';
  /**
   * How "exactly one answer" is proven for this puzzle.
   *  - `distinct`      every option renders differently (the usual case).
   *  - `singleOutlier` all options but one are deliberately identical, and the
   *                    answer is the single one that differs — the whole point
   *                    of "Which Is Different?".
   */
  readonly uniqueness?: 'distinct' | 'singleOutlier';
}

/**
 * Validates and finalises a generated puzzle.
 *
 * Guarantees enforced here — every one of them is a requirement of the game,
 * not a nicety:
 *   1. at least two options,
 *   2. no two options render identically (otherwise "the" answer is not unique),
 *   3. the answer index points at a real option,
 *   4. the options are shuffled, so the answer's position carries no signal.
 */
export function finalizePuzzle(input: DraftInput, rng: Rng): PuzzleDraft {
  const { contents, answerIndex } = input;

  if (contents.length < 2) {
    throw new AmbiguousPuzzleError(`${input.kind} produced ${contents.length} option(s)`);
  }
  if (answerIndex < 0 || answerIndex >= contents.length) {
    throw new AmbiguousPuzzleError(`${input.kind} answerIndex ${answerIndex} out of range`);
  }

  const signatures = contents.map(optionSignature);
  if ((input.uniqueness ?? 'distinct') === 'distinct') {
    assertAllDistinct(input.kind, signatures);
  } else {
    assertSingleOutlier(input.kind, signatures, answerIndex);
  }

  const ordered: PuzzleOption[] = contents.map((content, index) => ({
    id: `opt-${index}`,
    content,
  }));
  const answerId = (ordered[answerIndex] as PuzzleOption).id;

  return {
    kind: input.kind,
    difficulty: input.difficulty,
    title: input.title,
    instruction: input.instruction,
    board: input.board,
    options: rng.shuffle(ordered),
    answerId,
    timeLimitMs: input.timeLimitMs,
    explanation: input.explanation,
    optionLayout: input.optionLayout ?? 'grid',
    ...(input.memory ? { memory: input.memory } : {}),
  };
}

function assertAllDistinct(kind: PuzzleKind, signatures: readonly string[]): void {
  const seen = new Set<string>();
  for (const signature of signatures) {
    if (seen.has(signature)) {
      throw new AmbiguousPuzzleError(`${kind} has duplicate option "${signature}"`);
    }
    seen.add(signature);
  }
}

function assertSingleOutlier(
  kind: PuzzleKind,
  signatures: readonly string[],
  answerIndex: number,
): void {
  const groups = new Map<string, number[]>();
  signatures.forEach((signature, index) => {
    const bucket = groups.get(signature);
    if (bucket) bucket.push(index);
    else groups.set(signature, [index]);
  });

  if (groups.size !== 2) {
    throw new AmbiguousPuzzleError(
      `${kind} must have exactly one odd option, found ${groups.size} distinct renderings`,
    );
  }
  const singletons = [...groups.values()].filter((indices) => indices.length === 1);
  if (singletons.length !== 1) {
    throw new AmbiguousPuzzleError(`${kind} has ${singletons.length} candidate odd options`);
  }
  const [outlier] = singletons as [number[]];
  if (outlier[0] !== answerIndex) {
    throw new AmbiguousPuzzleError(`${kind} marks a non-outlier option as the answer`);
  }
}

/**
 * Distinct wrong numbers to sit alongside `answer`.
 *
 * Distractors start close to the answer, because a near-miss is what makes a
 * maths or sequence puzzle worth solving rather than eyeballing. When the near
 * field cannot supply enough candidates — a small answer leaves very little room
 * below it — the radius widens instead of failing, so the generator is total.
 */
export function numericDistractors(
  rng: Rng,
  answer: number,
  count: number,
  spread: number,
  options: { allowNegative?: boolean; reject?: (value: number) => boolean } = {},
): number[] {
  const allowNegative = options.allowNegative ?? false;
  const reject = options.reject ?? (() => false);

  const taken = new Set<number>([answer]);
  const chosen: number[] = [];
  let radius = Math.max(2, Math.round(spread));

  for (let round = 0; round < 12 && chosen.length < count; round += 1) {
    for (let attempt = 0; attempt < 160 && chosen.length < count; attempt += 1) {
      const value = answer + rng.int(1, radius) * (rng.bool() ? 1 : -1);
      if (taken.has(value)) continue;
      if (!allowNegative && value < 0) continue;
      if (reject(value)) continue;
      taken.add(value);
      chosen.push(value);
    }
    radius = Math.ceil(radius * 1.8) + 2;
  }

  if (chosen.length < count) {
    throw new AmbiguousPuzzleError(
      `could not build ${count} distinct distractors around ${answer}`,
    );
  }
  return chosen;
}

/** Lays out scatter cells on a jittered grid so nothing ever overlaps. */
export function scatterLayout(
  rng: Rng,
  cells: readonly Cell[],
  columns: number,
  rows: number,
): ScatterCell[] {
  const slots = rng.shuffle(
    Array.from({ length: columns * rows }, (_unused, index) => index),
  );
  if (cells.length > slots.length) {
    throw new AmbiguousPuzzleError(`scatter needs ${cells.length} slots, has ${slots.length}`);
  }
  // Keep a half-cell margin so glyphs never clip the board edge.
  const cellWidth = 1 / columns;
  const cellHeight = 1 / rows;
  const jitter = 0.22;

  return cells.map((value, index) => {
    const slot = slots[index] as number;
    const col = slot % columns;
    const row = Math.floor(slot / columns);
    const jx = (rng.next() - 0.5) * jitter * cellWidth;
    const jy = (rng.next() - 0.5) * jitter * cellHeight;
    return {
      ...value,
      x: (col + 0.5) * cellWidth + jx,
      y: (row + 0.5) * cellHeight + jy,
    };
  });
}

/**
 * Smallest p such that `items` is a strict repetition of its first p entries.
 * Used to prove a visible pattern really does pin down one continuation.
 */
export function minimalPeriod(items: readonly string[]): number {
  for (let period = 1; period <= items.length; period += 1) {
    let matches = true;
    for (let i = period; i < items.length; i += 1) {
      if (items[i] !== items[i - period]) {
        matches = false;
        break;
      }
    }
    if (matches) return period;
  }
  return items.length;
}

/**
 * Every value that could legitimately continue a repeating pattern.
 *
 * A period `q` only counts as an explanation if the visible run shows it at
 * least twice — otherwise "the pattern repeats every N items" would be
 * vacuously true for N = length, and no pattern puzzle could ever be fair.
 * A generator is only allowed to ship a pattern when this returns exactly one
 * value, which is precisely the "exactly one valid answer" guarantee.
 */
export function plausiblePeriodicNexts(visible: readonly string[]): string[] {
  const predictions = new Set<string>();
  for (let period = 1; period * 2 <= visible.length; period += 1) {
    let periodic = true;
    for (let i = period; i < visible.length; i += 1) {
      if (visible[i] !== visible[i - period]) {
        periodic = false;
        break;
      }
    }
    if (periodic) {
      predictions.add(visible[visible.length - period] as string);
    }
  }
  return [...predictions];
}

/**
 * Brain Rush game engine — shared types.
 *
 * Nothing in `src/engine` imports React, React Native or any Expo module. The
 * engine is a pure, deterministic, synchronously testable library; the UI layer
 * is only responsible for rendering the structures declared here.
 */

export const PUZZLE_KINDS = [
  'oddOneOut',
  'numberSequence',
  'shapePattern',
  'missingNumber',
  'quickMath',
  'memory',
  'countObjects',
  'colorLogic',
  'spatialReasoning',
  'whichIsDifferent',
  'matching',
  'symbolSequence',
] as const;

export type PuzzleKind = (typeof PUZZLE_KINDS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Shapes the renderer knows how to draw. */
export const SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'hexagon',
  'pentagon',
  'heart',
  'cross',
  'arrow',
  'flag',
  'blank',
] as const;
export type ShapeName = (typeof SHAPES)[number];

/** Palette slots — resolved to concrete hex values by the theme layer. */
export const GLYPH_COLORS = [
  'blue',
  'orange',
  'pink',
  'green',
  'purple',
  'yellow',
  'teal',
  'red',
] as const;
export type GlyphColor = (typeof GLYPH_COLORS)[number];

/**
 * A single drawable unit. Every visual puzzle is expressed as a arrangement of
 * cells so the renderer only ever needs to know how to draw one thing well.
 */
export interface Cell {
  readonly shape: ShapeName;
  readonly color: GlyphColor;
  /** Clockwise rotation in degrees. */
  readonly rotation: number;
  readonly filled: boolean;
  /** Relative size multiplier, 0.5 – 1.2. */
  readonly scale: number;
  /** Optional text drawn instead of / on top of the shape. */
  readonly label?: string;
  /** Render as a "?" placeholder rather than the underlying shape. */
  readonly hidden?: boolean;
  /** Renders with a muted/plain treatment (used for operators such as "→"). */
  readonly muted?: boolean;
}

export interface ScatterCell extends Cell {
  /** Normalised position inside the board, 0 – 1. */
  readonly x: number;
  readonly y: number;
}

export type PuzzleBoard =
  | { readonly kind: 'none' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'row'; readonly cells: readonly Cell[] }
  | { readonly kind: 'grid'; readonly cols: number; readonly cells: readonly Cell[] }
  | { readonly kind: 'scatter'; readonly cells: readonly ScatterCell[] };

export type OptionContent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'cell'; readonly cell: Cell }
  | { readonly kind: 'grid'; readonly cols: number; readonly cells: readonly Cell[] };

export interface PuzzleOption {
  readonly id: string;
  readonly content: OptionContent;
}

/**
 * Memory puzzles show a board, hide it, and only then reveal the question.
 * Keeping the study phase in the puzzle payload lets the engine stay pure while
 * the UI simply obeys the declared timings.
 */
export interface MemoryPhase {
  readonly board: PuzzleBoard;
  readonly studyMs: number;
  readonly studyPrompt: string;
}

export interface Puzzle {
  readonly id: string;
  readonly kind: PuzzleKind;
  readonly difficulty: Difficulty;
  /** Short label, e.g. "Odd One Out". */
  readonly title: string;
  /** What the player has to do, e.g. "Tap the shape that doesn't belong". */
  readonly instruction: string;
  readonly board: PuzzleBoard;
  readonly options: readonly PuzzleOption[];
  /** Always present in `options` — enforced by `finalizePuzzle`. */
  readonly answerId: string;
  readonly timeLimitMs: number;
  /** Shown when the answer is revealed or missed. */
  readonly explanation: string;
  readonly memory?: MemoryPhase;
  /** Lay options out in a single column (used for long text answers). */
  readonly optionLayout: 'grid' | 'list';
}

/** A generator's output before the engine stamps identity onto it. */
export type PuzzleDraft = Omit<Puzzle, 'id'>;

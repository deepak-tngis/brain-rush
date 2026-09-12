import { baseTimeLimit, difficultyForIndex, timeLimitForIndex } from './difficulty';
import { GENERATORS, KIND_WEIGHTS } from './generators';
import { createRng, hashSeed } from './rng';
import type { Rng } from './rng';
import { PUZZLE_KINDS } from './types';
import type { Difficulty, Puzzle, PuzzleDraft, PuzzleKind } from './types';

export interface PuzzleRequest {
  /** Run seed; identical seeds always produce identical runs. */
  readonly seed: number;
  /** Zero-based question number — drives both difficulty and the sub-seed. */
  readonly index: number;
  /** Kinds to avoid so the same puzzle type never appears twice in a row. */
  readonly avoid?: readonly PuzzleKind[];
  /** Pin the kind (used by tests and by themed challenges). */
  readonly kind?: PuzzleKind;
}

function weightedKind(rng: Rng, avoid: readonly PuzzleKind[]): PuzzleKind {
  const candidates = PUZZLE_KINDS.filter((kind) => !avoid.includes(kind));
  const pool: readonly PuzzleKind[] = candidates.length > 0 ? candidates : PUZZLE_KINDS;
  const total = pool.reduce((sum, kind) => sum + KIND_WEIGHTS[kind], 0);

  let ticket = rng.next() * total;
  for (const kind of pool) {
    ticket -= KIND_WEIGHTS[kind];
    if (ticket <= 0) return kind;
  }
  return pool[pool.length - 1] as PuzzleKind;
}

function tryGenerate(kind: PuzzleKind, rng: Rng, difficulty: Difficulty): PuzzleDraft | null {
  try {
    return GENERATORS[kind](rng, difficulty);
  } catch {
    // A generator that cannot find an unambiguous puzzle for this particular
    // seed refuses to ship an ambiguous one. Callers simply try again — the
    // player must never see a puzzle with two defensible answers, and must
    // never see a crash either.
    return null;
  }
}

/**
 * Builds one puzzle. Deterministic in `(seed, index)`, and total: if a kind
 * cannot produce a clean puzzle for this seed the factory moves on to another
 * kind rather than failing.
 */
export function createPuzzle(request: PuzzleRequest): Puzzle {
  const { seed, index, avoid = [], kind: pinnedKind } = request;
  const difficulty = difficultyForIndex(index);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    // Each attempt gets its own sub-stream, so a retry genuinely resamples
    // while the whole run stays reproducible from the run seed alone.
    const rng = createRng(hashSeed(seed, index, attempt));
    const kind = pinnedKind ?? weightedKind(rng, attempt < 8 ? avoid : []);
    const draft = tryGenerate(kind, rng, difficulty);
    if (draft === null) continue;

    return { ...draft, id: `p-${seed}-${index}`, timeLimitMs: pacedTimeLimit(draft, index) };
  }

  // Quick Math is the most constrained generator in the set and has no rejection
  // path, so it is the guaranteed backstop.
  const rng = createRng(hashSeed(seed, index, 'fallback'));
  const draft = GENERATORS.quickMath(rng, difficulty);
  return { ...draft, id: `p-${seed}-${index}`, timeLimitMs: pacedTimeLimit(draft, index) };
}

/**
 * Reconciles the two things that set the clock: the difficulty band (which keeps
 * tightening as the run goes on) and the generator's own multiplier (counting
 * twenty objects needs longer than reading "7 x 8"). The generator's multiplier
 * is recovered from its draft and re-applied to the band's current window.
 */
function pacedTimeLimit(draft: PuzzleDraft, index: number): number {
  const generatorScale = draft.timeLimitMs / baseTimeLimit(draft.difficulty);
  return Math.round(timeLimitForIndex(index) * generatorScale);
}

export function createPuzzleSequence(seed: number, count: number): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = puzzles.slice(-2).map((puzzle) => puzzle.kind);
    puzzles.push(createPuzzle({ seed, index, avoid: previous }));
  }
  return puzzles;
}

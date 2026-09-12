import { difficultyForIndex } from '../difficulty';
import { GENERATORS } from '../generators';
import { optionSignature } from '../puzzleKit';
import { createRng, hashSeed } from '../rng';
import { DIFFICULTIES, PUZZLE_KINDS } from '../types';
import type { Difficulty, Puzzle, PuzzleDraft, PuzzleKind } from '../types';
import { createPuzzle, createPuzzleSequence } from '../puzzleFactory';

/** How many seeds each generator is hammered with. Cheap, and catches a lot. */
const SEEDS_PER_CASE = 150;

function generate(kind: PuzzleKind, difficulty: Difficulty, seed: number): PuzzleDraft {
  return GENERATORS[kind](createRng(hashSeed(kind, difficulty, seed)), difficulty);
}

function eachCase(run: (kind: PuzzleKind, difficulty: Difficulty, seed: number) => void): void {
  for (const kind of PUZZLE_KINDS) {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < SEEDS_PER_CASE; seed += 1) {
        run(kind, difficulty, seed);
      }
    }
  }
}

describe('every generator produces a well-formed puzzle', () => {
  it('never throws across a wide sweep of seeds', () => {
    eachCase((kind, difficulty, seed) => {
      expect(() => generate(kind, difficulty, seed)).not.toThrow();
    });
  });

  it('always marks exactly one option as the answer', () => {
    eachCase((kind, difficulty, seed) => {
      const puzzle = generate(kind, difficulty, seed);
      const matches = puzzle.options.filter((option) => option.id === puzzle.answerId);
      expect(matches).toHaveLength(1);
    });
  });

  it('offers at least four options with unique ids', () => {
    eachCase((kind, difficulty, seed) => {
      const puzzle = generate(kind, difficulty, seed);
      expect(puzzle.options.length).toBeGreaterThanOrEqual(4);
      const ids = new Set(puzzle.options.map((option) => option.id));
      expect(ids.size).toBe(puzzle.options.length);
    });
  });

  it('reports the difficulty it was asked for', () => {
    eachCase((kind, difficulty, seed) => {
      expect(generate(kind, difficulty, seed).difficulty).toBe(difficulty);
    });
  });

  it('always gives the player a positive decision window', () => {
    eachCase((kind, difficulty, seed) => {
      expect(generate(kind, difficulty, seed).timeLimitMs).toBeGreaterThan(2000);
    });
  });

  it('always carries an instruction and an explanation', () => {
    eachCase((kind, difficulty, seed) => {
      const puzzle = generate(kind, difficulty, seed);
      expect(puzzle.instruction.length).toBeGreaterThan(0);
      expect(puzzle.explanation.length).toBeGreaterThan(0);
      expect(puzzle.title.length).toBeGreaterThan(0);
    });
  });
});

describe('exactly one valid answer', () => {
  /**
   * The acceptance criterion in prose is "every generated puzzle has exactly one
   * valid answer". On screen that means: no two options may look the same, or
   * the player could tap a visually identical twin of the answer and be marked
   * wrong. "Which Is Different?" is the deliberate exception — there, all but
   * one option are identical by design, and the *answer* must be the singleton.
   */
  it('renders no two options identically', () => {
    eachCase((kind, difficulty, seed) => {
      if (kind === 'whichIsDifferent') return;
      const puzzle = generate(kind, difficulty, seed);
      const signatures = puzzle.options.map((option) => optionSignature(option.content));
      expect(new Set(signatures).size).toBe(signatures.length);
    });
  });

  it('makes the single odd tile the answer in Which Is Different', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < SEEDS_PER_CASE; seed += 1) {
        const puzzle = generate('whichIsDifferent', difficulty, seed);
        const counts = new Map<string, number>();
        for (const option of puzzle.options) {
          const signature = optionSignature(option.content);
          counts.set(signature, (counts.get(signature) ?? 0) + 1);
        }
        const answer = puzzle.options.find((option) => option.id === puzzle.answerId);
        expect(answer).toBeDefined();

        const answerSignature = optionSignature((answer as NonNullable<typeof answer>).content);
        expect(counts.get(answerSignature)).toBe(1);
        // Every other tile is identical to every other tile.
        expect(counts.size).toBe(2);
      }
    }
  });

  it('never offers an option that duplicates the answer', () => {
    eachCase((kind, difficulty, seed) => {
      const puzzle = generate(kind, difficulty, seed);
      const answer = puzzle.options.find((option) => option.id === puzzle.answerId);
      const answerSignature = optionSignature((answer as NonNullable<typeof answer>).content);
      const duplicates = puzzle.options.filter(
        (option) =>
          option.id !== puzzle.answerId && optionSignature(option.content) === answerSignature,
      );
      expect(duplicates).toHaveLength(0);
    });
  });
});

describe('determinism', () => {
  it('produces byte-identical puzzles for the same seed and index', () => {
    for (let index = 0; index < 25; index += 1) {
      const first = createPuzzle({ seed: 4242, index });
      const second = createPuzzle({ seed: 4242, index });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it('produces different runs for different seeds', () => {
    const a = createPuzzleSequence(1, 12);
    const b = createPuzzleSequence(2, 12);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('the puzzle factory', () => {
  it('never fails, whatever the seed', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      expect(() => createPuzzle({ seed, index: seed % 20 })).not.toThrow();
    }
  });

  it('follows the difficulty curve', () => {
    for (let index = 0; index < 20; index += 1) {
      expect(createPuzzle({ seed: 99, index }).difficulty).toBe(difficultyForIndex(index));
    }
  });

  it('tightens the decision window as a run goes on', () => {
    const early = createPuzzle({ seed: 7, index: 0, kind: 'quickMath' });
    const late = createPuzzle({ seed: 7, index: 18, kind: 'quickMath' });
    expect(late.timeLimitMs).toBeLessThan(early.timeLimitMs);
  });

  it('honours a pinned kind', () => {
    for (let index = 0; index < 12; index += 1) {
      expect(createPuzzle({ seed: 5, index, kind: 'matching' }).kind).toBe('matching');
    }
  });

  it('avoids repeating a puzzle type back to back', () => {
    const sequence: Puzzle[] = createPuzzleSequence(31337, 40);
    let repeats = 0;
    for (let i = 1; i < sequence.length; i += 1) {
      if ((sequence[i] as Puzzle).kind === (sequence[i - 1] as Puzzle).kind) repeats += 1;
    }
    expect(repeats).toBe(0);
  });

  it('reaches every puzzle type over a long run', () => {
    const seen = new Set<PuzzleKind>();
    for (let seed = 0; seed < 40; seed += 1) {
      for (const puzzle of createPuzzleSequence(seed, 20)) seen.add(puzzle.kind);
    }
    expect(seen.size).toBe(PUZZLE_KINDS.length);
  });
});

/**
 * Deterministic pseudo-random number generator.
 *
 * Puzzle generation must be reproducible: the daily challenge has to produce an
 * identical sequence on every device, offline, with no server involved, and the
 * unit tests need to be able to replay a failing seed. `Math.random` gives us
 * none of that, so the whole engine is parameterised over this interface.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number;
  bool(probability?: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Returns a shuffled copy; the input is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct elements drawn without replacement. */
  sample<T>(items: readonly T[], count: number): T[];
}

/** mulberry32 - small, fast, and good enough for puzzle shuffling. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  // A zero seed degenerates to a constant stream, so nudge it off zero.
  if (state === 0) state = 0x6d2b79f5;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`rng.int: empty range [${min}, ${max}]`);
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('rng.pick: empty collection');
    return items[int(0, items.length - 1)] as T;
  };

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      const a = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = a;
    }
    return copy;
  };

  const sample = <T,>(items: readonly T[], count: number): T[] => {
    if (count > items.length) {
      throw new Error(`rng.sample: need ${count} of ${items.length}`);
    }
    return shuffle(items).slice(0, count);
  };

  return {
    next,
    int,
    bool: (probability = 0.5) => next() < probability,
    pick,
    shuffle,
    sample,
  };
}

const SEED_SEPARATOR = '#';

/**
 * Stable 32-bit hash used to turn human-meaningful keys (a date string, a run
 * index) into seeds. FNV-1a: tiny and with good avalanche for short strings.
 */
export function hashSeed(...parts: ReadonlyArray<string | number>): number {
  let hash = 0x811c9dc5;
  const input = parts.join(SEED_SEPARATOR);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

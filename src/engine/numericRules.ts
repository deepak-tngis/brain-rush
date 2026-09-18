/**
 * The closed world of numeric rules Brain Rush is willing to pose.
 *
 * Number puzzles are ambiguous in the abstract — infinitely many formulas fit
 * any finite prefix. Brain Rush makes them well-posed by fixing a small, stated
 * universe of rules and then *proving*, for every puzzle it ships, that within
 * that universe exactly one continuation exists and exactly one offered option
 * matches it. Both the generators and the tests use the functions below, so the
 * guarantee and the gameplay can never drift apart.
 */

export interface NumericFamily {
  readonly name: string;
  /** Whether the whole run obeys this rule. */
  fits(terms: readonly number[]): boolean;
  /** The value that follows; only meaningful when `fits` is true. */
  next(terms: readonly number[]): number;
}

function differences(terms: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < terms.length; i += 1) {
    out.push((terms[i] as number) - (terms[i - 1] as number));
  }
  return out;
}

function allEqual(values: readonly number[]): boolean {
  return values.every((value) => value === values[0]);
}

const arithmetic: NumericFamily = {
  name: 'arithmetic',
  fits: (terms) => {
    if (terms.length < 3) return false;
    const diffs = differences(terms);
    return diffs[0] !== 0 && allEqual(diffs);
  },
  next: (terms) => (terms[terms.length - 1] as number) + (differences(terms)[0] as number),
};

const geometric: NumericFamily = {
  name: 'geometric',
  fits: (terms) => {
    if (terms.length < 3) return false;
    const first = terms[0] as number;
    if (first === 0) return false;
    const ratio = (terms[1] as number) / first;
    if (!Number.isInteger(ratio) || ratio === 0 || ratio === 1) return false;
    for (let i = 1; i < terms.length; i += 1) {
      if ((terms[i] as number) !== (terms[i - 1] as number) * ratio) return false;
    }
    return true;
  },
  next: (terms) =>
    (terms[terms.length - 1] as number) * ((terms[1] as number) / (terms[0] as number)),
};

/** Constant second difference: 1, 2, 4, 7, 11 … (step grows by a fixed amount). */
const quadratic: NumericFamily = {
  name: 'quadratic',
  fits: (terms) => {
    if (terms.length < 4) return false;
    const second = differences(differences(terms));
    return allEqual(second);
  },
  next: (terms) => {
    const diffs = differences(terms);
    const second = differences(diffs)[0] as number;
    return (terms[terms.length - 1] as number) + (diffs[diffs.length - 1] as number) + second;
  },
};

/** Each term is the sum of the two before it. */
const fibonacci: NumericFamily = {
  name: 'fibonacci',
  fits: (terms) => {
    if (terms.length < 4) return false;
    for (let i = 2; i < terms.length; i += 1) {
      if ((terms[i] as number) !== (terms[i - 1] as number) + (terms[i - 2] as number)) {
        return false;
      }
    }
    return true;
  },
  next: (terms) =>
    (terms[terms.length - 1] as number) + (terms[terms.length - 2] as number),
};

/** Two differences taking turns: +3, -1, +3, -1 … */
const alternating: NumericFamily = {
  name: 'alternating',
  fits: (terms) => {
    if (terms.length < 4) return false;
    const diffs = differences(terms);
    for (let i = 2; i < diffs.length; i += 1) {
      if (diffs[i] !== diffs[i - 2]) return false;
    }
    return true;
  },
  next: (terms) => {
    const diffs = differences(terms);
    const nextDiff = diffs[diffs.length - 1 < 1 ? 0 : diffs.length - 2] as number;
    return (terms[terms.length - 1] as number) + nextDiff;
  },
};

/**
 * Multiply-then-add: each term is a*previous + b with a >= 2 and b != 0, e.g.
 * 1, 3, 7, 15 (x2 + 1). a = 1 is arithmetic and b = 0 is geometric, so those
 * are left to the families that own them.
 */
function affineCoefficients(terms: readonly number[]): { a: number; b: number } | null {
  if (terms.length < 3) return null;
  const [t0, t1, t2] = terms as [number, number, number];
  if (t1 === t0) return null;
  const a = (t2 - t1) / (t1 - t0);
  if (!Number.isInteger(a) || a < 2) return null;
  const b = t1 - a * t0;
  if (b === 0) return null;
  return { a, b };
}

const affine: NumericFamily = {
  name: 'affine',
  fits: (terms) => {
    if (terms.length < 4) return false;
    const coefficients = affineCoefficients(terms);
    if (coefficients === null) return false;
    for (let i = 1; i < terms.length; i += 1) {
      const expected = coefficients.a * (terms[i - 1] as number) + coefficients.b;
      if ((terms[i] as number) !== expected) return false;
    }
    return true;
  },
  next: (terms) => {
    const { a, b } = affineCoefficients(terms) as { a: number; b: number };
    return a * (terms[terms.length - 1] as number) + b;
  },
};

const PRIME_LIMIT = 2000;
let primeList: readonly number[] | null = null;

/** Every prime up to a comfortable ceiling, computed once. */
export function smallPrimes(): readonly number[] {
  if (primeList !== null) return primeList;
  const sieve = new Array<boolean>(PRIME_LIMIT + 1).fill(true);
  sieve[0] = false;
  sieve[1] = false;
  for (let p = 2; p * p <= PRIME_LIMIT; p += 1) {
    if (!sieve[p]) continue;
    for (let multiple = p * p; multiple <= PRIME_LIMIT; multiple += p) sieve[multiple] = false;
  }
  const out: number[] = [];
  sieve.forEach((isPrime, value) => {
    if (isPrime) out.push(value);
  });
  primeList = out;
  return out;
}

/** Consecutive primes: 5, 7, 11, 13 -> 17. */
const consecutivePrimes: NumericFamily = {
  name: 'primes',
  fits: (terms) => {
    if (terms.length < 3) return false;
    const list = smallPrimes();
    const start = list.indexOf(terms[0] as number);
    if (start < 0 || start + terms.length >= list.length) return false;
    return terms.every((term, index) => list[start + index] === term);
  },
  next: (terms) => {
    const list = smallPrimes();
    return list[list.indexOf(terms[0] as number) + terms.length] as number;
  },
};

/**
 * Two arithmetic runs taking turns: 2, 50, 4, 45, 6, 40 -> 8. Each lane needs
 * three terms before it counts as a rule, hence the six-term minimum.
 */
function lanes(terms: readonly number[]): [number[], number[]] {
  const even: number[] = [];
  const odd: number[] = [];
  terms.forEach((term, index) => (index % 2 === 0 ? even : odd).push(term));
  return [even, odd];
}

const interleaved: NumericFamily = {
  name: 'interleaved',
  fits: (terms) => {
    if (terms.length < 6) return false;
    const [even, odd] = lanes(terms);
    const evenDiffs = differences(even);
    const oddDiffs = differences(odd);
    if (!allEqual(evenDiffs) || !allEqual(oddDiffs)) return false;
    return evenDiffs[0] !== 0 || oddDiffs[0] !== 0;
  },
  next: (terms) => {
    const [even, odd] = lanes(terms);
    const lane = terms.length % 2 === 0 ? even : odd;
    return (lane[lane.length - 1] as number) + (differences(lane)[0] as number);
  },
};

export const NUMERIC_FAMILIES: readonly NumericFamily[] = [
  arithmetic,
  geometric,
  quadratic,
  fibonacci,
  alternating,
  affine,
  consecutivePrimes,
  interleaved,
];

/** Every value the rule universe considers a legal continuation of `terms`. */
export function predictNext(terms: readonly number[]): number[] {
  const predictions = new Set<number>();
  for (const family of NUMERIC_FAMILIES) {
    if (family.fits(terms)) predictions.add(family.next(terms));
  }
  return [...predictions];
}

/** True when at least one rule in the universe explains the whole run. */
export function fitsAnyFamily(terms: readonly number[]): boolean {
  return NUMERIC_FAMILIES.some((family) => family.fits(terms));
}

/** Names of the rules that explain the run — used for player-facing hints. */
export function matchingFamilyNames(terms: readonly number[]): string[] {
  return NUMERIC_FAMILIES.filter((family) => family.fits(terms)).map((family) => family.name);
}

/**
 * A run is only usable as a puzzle when the rule universe agrees on a single
 * continuation. If two families disagree the run is thrown away and resampled.
 */
export function hasUniqueContinuation(terms: readonly number[]): boolean {
  return predictNext(terms).length === 1;
}

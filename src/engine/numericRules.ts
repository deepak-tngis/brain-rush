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

export const NUMERIC_FAMILIES: readonly NumericFamily[] = [
  arithmetic,
  geometric,
  quadratic,
  fibonacci,
  alternating,
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

import { fitsAnyFamily, hasUniqueContinuation, matchingFamilyNames, predictNext } from '../numericRules';
import { minimalPeriod, plausiblePeriodicNexts } from '../puzzleKit';

describe('numeric rule universe', () => {
  it('continues an arithmetic run', () => {
    expect(predictNext([2, 5, 8, 11])).toEqual([14]);
    expect(matchingFamilyNames([2, 5, 8, 11])).toContain('arithmetic');
  });

  it('continues a geometric run', () => {
    expect(predictNext([3, 6, 12, 24])).toEqual([48]);
  });

  it('continues a run whose gap grows', () => {
    expect(predictNext([1, 2, 4, 7, 11])).toEqual([16]);
  });

  it('continues a fibonacci-style run', () => {
    expect(predictNext([2, 3, 5, 8, 13])).toEqual([21]);
  });

  it('continues an alternating run', () => {
    expect(predictNext([5, 12, 10, 17, 15])).toEqual([22]);
  });

  it('continues a multiply-then-add run', () => {
    expect(predictNext([1, 3, 7, 15])).toEqual([31]);
    expect(matchingFamilyNames([1, 3, 7, 15])).toEqual(['affine']);
    expect(predictNext([2, 5, 14, 41])).toEqual([122]);
  });

  it('continues the primes', () => {
    expect(predictNext([2, 3, 5, 7, 11])).toEqual([13]);
    expect(matchingFamilyNames([2, 3, 5, 7, 11])).toEqual(['primes']);
  });

  it('refuses a prime run that another rule would continue differently', () => {
    // 13, 17, 19, 23 also reads as +4, +2, +4, +2 … which says 25.
    expect(hasUniqueContinuation([13, 17, 19, 23])).toBe(false);
  });

  it('continues two interleaved runs along the right lane', () => {
    expect(predictNext([2, 50, 4, 45, 6, 40])).toEqual([8]);
    expect(predictNext([2, 50, 4, 45, 6, 40, 8])).toEqual([35]);
    expect(matchingFamilyNames([2, 50, 4, 45, 6, 40])).toEqual(['interleaved']);
  });

  it('needs three terms per lane before it will call a run interleaved', () => {
    expect(matchingFamilyNames([2, 50, 4, 45, 6])).not.toContain('interleaved');
  });

  it('refuses to continue a run no rule explains', () => {
    expect(predictNext([4, 9, 1, 25])).toEqual([]);
    expect(fitsAnyFamily([4, 9, 1, 25])).toBe(false);
  });

  it('collapses agreeing rules to one continuation', () => {
    // 2, 4, 6, 8 is arithmetic, quadratic (zero second difference) and
    // alternating all at once - and every one of them says 10. Agreement is what
    // makes the run safe to pose as a puzzle.
    expect(matchingFamilyNames([2, 4, 6, 8]).length).toBeGreaterThan(1);
    expect(predictNext([2, 4, 6, 8])).toEqual([10]);
    expect(hasUniqueContinuation([2, 4, 6, 8])).toBe(true);
  });

  it('treats a short run as unusable when rules would fight over it', () => {
    // Rules that need four terms to be pinned down simply do not apply to three,
    // which is why every generator shows at least four.
    expect(hasUniqueContinuation([1, 2])).toBe(false);
    expect(predictNext([1, 2])).toEqual([]);
  });

  it('continues a constant run as itself rather than calling it ambiguous', () => {
    expect(predictNext([7, 7, 7, 7])).toEqual([7]);
    expect(hasUniqueContinuation([7, 7, 7, 7])).toBe(true);
  });
});

describe('periodic patterns', () => {
  it('finds the shortest repeat', () => {
    expect(minimalPeriod(['a', 'b', 'a', 'b', 'a'])).toBe(2);
    expect(minimalPeriod(['a', 'b', 'c', 'a', 'b', 'c'])).toBe(3);
    expect(minimalPeriod(['a', 'b', 'c', 'd'])).toBe(4);
  });

  it('predicts a single continuation when the cycle is shown twice', () => {
    expect(plausiblePeriodicNexts(['a', 'b', 'a', 'b', 'a'])).toEqual(['b']);
    expect(plausiblePeriodicNexts(['a', 'b', 'c', 'a', 'b', 'c', 'a'])).toEqual(['b']);
  });

  it('ignores periods that were never actually repeated', () => {
    // Only one full pass of "a b c d" is visible, so nothing is provable.
    expect(plausiblePeriodicNexts(['a', 'b', 'c', 'd'])).toEqual([]);
  });

  it('reports every candidate when a run is genuinely ambiguous', () => {
    // "a a a a" repeats with period 1 and with period 2; both predict "a".
    expect(plausiblePeriodicNexts(['a', 'a', 'a', 'a'])).toEqual(['a']);
  });
});

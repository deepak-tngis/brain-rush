/** Public surface of the game engine. The UI imports only from here. */
export * from './types';
export * from './rng';
export * from './difficulty';
export * from './scoring';
export * from './session';
export * from './daily';
export { createPuzzle, createPuzzleSequence } from './puzzleFactory';
export type { PuzzleRequest } from './puzzleFactory';
export { GENERATORS, KIND_WEIGHTS } from './generators';
export type { PuzzleGenerator } from './generators';
export {
  AmbiguousPuzzleError,
  cellSignature,
  optionSignature,
  minimalPeriod,
  plausiblePeriodicNexts,
} from './puzzleKit';
export { predictNext, fitsAnyFamily, hasUniqueContinuation } from './numericRules';

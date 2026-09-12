import type { Rng } from '../rng';
import type { Difficulty, PuzzleDraft, PuzzleKind } from '../types';
import { generateColorLogic } from './colorLogic';
import { generateCountObjects } from './countObjects';
import { generateMatching } from './matching';
import { generateMemory } from './memory';
import { generateMissingNumber } from './missingNumber';
import { generateNumberSequence } from './numberSequence';
import { generateOddOneOut } from './oddOneOut';
import { generateQuickMath } from './quickMath';
import { generateShapePattern } from './shapePattern';
import { generateSpatialReasoning } from './spatialReasoning';
import { generateSymbolSequence } from './symbolSequence';
import { generateWhichIsDifferent } from './whichIsDifferent';

export type PuzzleGenerator = (rng: Rng, difficulty: Difficulty) => PuzzleDraft;

export const GENERATORS: Readonly<Record<PuzzleKind, PuzzleGenerator>> = {
  oddOneOut: generateOddOneOut,
  numberSequence: generateNumberSequence,
  shapePattern: generateShapePattern,
  missingNumber: generateMissingNumber,
  quickMath: generateQuickMath,
  memory: generateMemory,
  countObjects: generateCountObjects,
  colorLogic: generateColorLogic,
  spatialReasoning: generateSpatialReasoning,
  whichIsDifferent: generateWhichIsDifferent,
  matching: generateMatching,
  symbolSequence: generateSymbolSequence,
};

/**
 * Relative frequency of each puzzle type.
 *
 * Memory costs the player a mandatory study phase, so it appears less often;
 * the quick-read types carry the pace the game is built around.
 */
export const KIND_WEIGHTS: Readonly<Record<PuzzleKind, number>> = {
  oddOneOut: 12,
  numberSequence: 10,
  shapePattern: 10,
  missingNumber: 9,
  quickMath: 12,
  memory: 5,
  countObjects: 9,
  colorLogic: 8,
  spatialReasoning: 8,
  whichIsDifferent: 9,
  matching: 9,
  symbolSequence: 9,
};

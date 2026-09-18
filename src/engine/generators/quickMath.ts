import { baseTimeLimit, optionCountFor } from '../difficulty';
import { finalizePuzzle, numericDistractors, textOption } from '../puzzleKit';
import type { Rng } from '../rng';
import type { Difficulty, PuzzleDraft } from '../types';

interface Expression {
  readonly text: string;
  readonly value: number;
  /**
   * Results a distracted player might arrive at (wrong operator order, an
   * off-by-one carry). They are excluded from the distractor pool so a wrong tap
   * is never "also arguably right", and used as near-misses only when they are
   * genuinely wrong.
   */
  readonly nearMisses: readonly number[];
}

function easyExpression(rng: Rng): Expression {
  const kind = rng.pick(['add', 'sub', 'mul'] as const);
  if (kind === 'add') {
    const a = rng.int(6, 49);
    const b = rng.int(3, 39);
    return { text: `${a} + ${b}`, value: a + b, nearMisses: [a - b, a + b + 10, a + b - 10] };
  }
  if (kind === 'sub') {
    const a = rng.int(20, 70);
    const b = rng.int(3, a - 2);
    return { text: `${a} - ${b}`, value: a - b, nearMisses: [a + b, a - b - 10] };
  }
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  return { text: `${a} x ${b}`, value: a * b, nearMisses: [a + b, a * b + a, a * b - a] };
}

function mediumExpression(rng: Rng): Expression {
  const kind = rng.pick(['mulAdd', 'mulSub', 'sumMul', 'div'] as const);
  if (kind === 'mulAdd') {
    const a = rng.int(3, 9);
    const b = rng.int(3, 9);
    const c = rng.int(4, 30);
    return { text: `${a} x ${b} + ${c}`, value: a * b + c, nearMisses: [(a + c) * b, a * b - c] };
  }
  if (kind === 'mulSub') {
    const a = rng.int(4, 9);
    const b = rng.int(3, 9);
    const c = rng.int(2, Math.max(2, a * b - 2));
    return { text: `${a} x ${b} - ${c}`, value: a * b - c, nearMisses: [a * b + c, a * (b - c)] };
  }
  if (kind === 'sumMul') {
    const a = rng.int(2, 12);
    const b = rng.int(2, 12);
    const c = rng.int(2, 6);
    return { text: `(${a} + ${b}) x ${c}`, value: (a + b) * c, nearMisses: [a + b * c, (a + b) + c] };
  }
  const b = rng.int(2, 9);
  const q = rng.int(3, 12);
  return { text: `${b * q} / ${b}`, value: q, nearMisses: [b * q, q + b, b] };
}

function hardExpression(rng: Rng): Expression {
  const kind = rng.pick(['twoMul', 'mixed', 'divAdd', 'chain'] as const);
  if (kind === 'twoMul') {
    const a = rng.int(3, 9);
    const b = rng.int(3, 9);
    const c = rng.int(2, 9);
    const d = rng.int(2, 9);
    return {
      text: `${a} x ${b} + ${c} x ${d}`,
      value: a * b + c * d,
      nearMisses: [a * b * c * d, (a * b + c) * d, a * (b + c) * d],
    };
  }
  if (kind === 'mixed') {
    const a = rng.int(4, 12);
    const b = rng.int(2, 9);
    const c = rng.int(2, 9);
    return {
      text: `${a} x (${b} + ${c})`,
      value: a * (b + c),
      nearMisses: [a * b + c, a + b * c, a * b * c],
    };
  }
  if (kind === 'divAdd') {
    const b = rng.int(2, 9);
    const q = rng.int(3, 12);
    const c = rng.int(3, 40);
    return { text: `${b * q} / ${b} + ${c}`, value: q + c, nearMisses: [(b * q + c) / b, b * q + c] };
  }
  const a = rng.int(20, 90);
  const b = rng.int(3, 19);
  const c = rng.int(2, 19);
  return { text: `${a} - ${b} + ${c}`, value: a - b + c, nearMisses: [a - b - c, a + b + c, a + b - c] };
}

/** Longer chains and mixed precedence: every near-miss is a real slip. */
function expertExpression(rng: Rng): Expression {
  const kind = rng.pick(['twoMulSub', 'sumDiffMul', 'divMul', 'chain3', 'mulSquare'] as const);
  if (kind === 'twoMulSub') {
    const a = rng.int(6, 12);
    const b = rng.int(5, 9);
    const c = rng.int(2, 6);
    const d = rng.int(2, 6);
    return {
      text: `${a} x ${b} - ${c} x ${d}`,
      value: a * b - c * d,
      nearMisses: [a * b + c * d, (a * b - c) * d, a * (b - c) * d],
    };
  }
  if (kind === 'sumDiffMul') {
    const a = rng.int(3, 12);
    const b = rng.int(2, 12);
    const c = rng.int(5, 12);
    const d = rng.int(1, c - 1);
    return {
      text: `(${a} + ${b}) x (${c} - ${d})`,
      value: (a + b) * (c - d),
      nearMisses: [a + b * c - d, (a + b) * c - d, (a + b) * (c + d)],
    };
  }
  if (kind === 'divMul') {
    const c = rng.int(2, 9);
    const q = rng.int(3, 12);
    const b = rng.int(3, 9);
    return {
      text: `${c * q} / ${c} x ${b}`,
      value: q * b,
      nearMisses: [q + b, Math.round((c * q) / (c * b)), c * q * b],
    };
  }
  if (kind === 'chain3') {
    const a = rng.int(40, 120);
    const b = rng.int(5, 29);
    const c = rng.int(5, 29);
    const d = rng.int(5, Math.min(29, a - b + c - 1));
    return {
      text: `${a} - ${b} + ${c} - ${d}`,
      value: a - b + c - d,
      nearMisses: [a - b - c - d, a + b + c + d, a - (b + c) - d, a - b + c + d],
    };
  }
  const a = rng.int(4, 12);
  const b = rng.int(5, 40);
  return {
    text: `${a} x ${a} - ${b}`,
    value: a * a - b,
    nearMisses: [a * a + b, a + a - b, a * (a - b)],
  };
}

export function generateQuickMath(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const expression =
    difficulty === 'easy'
      ? easyExpression(rng)
      : difficulty === 'medium'
        ? mediumExpression(rng)
        : difficulty === 'hard'
          ? hardExpression(rng)
          : expertExpression(rng);

  const optionCount = optionCountFor(difficulty, 4, 4, 6);
  const { value } = expression;

  // Near-misses first — they punish sloppy operator precedence, which is exactly
  // the skill the hard band is testing.
  const chosen: number[] = [];
  const seen = new Set<number>([value]);
  for (const near of rng.shuffle(expression.nearMisses)) {
    if (chosen.length >= Math.min(difficulty === 'expert' ? 3 : 2, optionCount - 1)) break;
    if (!Number.isInteger(near) || near < 0 || seen.has(near)) continue;
    seen.add(near);
    chosen.push(near);
  }

  const spread = Math.max(3, Math.round(Math.abs(value) * 0.2));
  const remaining = optionCount - 1 - chosen.length;
  if (remaining > 0) {
    chosen.push(
      ...numericDistractors(rng, value, remaining, spread, {
        reject: (candidate) => seen.has(candidate) || candidate < 0,
      }),
    );
  }

  return finalizePuzzle(
    {
      kind: 'quickMath',
      difficulty,
      title: 'Quick Math',
      instruction: 'Solve it',
      board: { kind: 'text', text: `${expression.text} = ?` },
      contents: [textOption(String(value)), ...chosen.map((v) => textOption(String(v)))],
      answerIndex: 0,
      timeLimitMs: baseTimeLimit(difficulty, difficulty === 'easy' ? 0.8 : 1),
      explanation: `${expression.text} = ${value}.`,
    },
    rng,
  );
}

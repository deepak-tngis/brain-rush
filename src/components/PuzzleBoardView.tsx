import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cell, PuzzleBoard } from '../engine';
import { colors, radii, spacing } from '../theme/theme';
import { Glyph } from './Glyph';

/**
 * Renders whatever the engine hands over.
 *
 * Sizing is derived entirely from the width this component is given, so the
 * board fills a small phone and a large one equally well without a single
 * hardcoded device dimension.
 */
export interface PuzzleBoardViewProps {
  readonly board: PuzzleBoard;
  /** Width available to the board, measured by the parent. */
  readonly width: number;
  /** Height available; the scatter board uses it to place glyphs. */
  readonly height: number;
}

const MAX_GLYPH = 64;
const MIN_GLYPH = 20;

function clampGlyph(size: number): number {
  return Math.max(MIN_GLYPH, Math.min(MAX_GLYPH, Math.floor(size)));
}

export function PuzzleBoardView({
  board,
  width,
  height,
}: PuzzleBoardViewProps): React.ReactElement | null {
  const content = useMemo(() => {
    switch (board.kind) {
      case 'none':
        return null;

      case 'text':
        return (
          <Text
            style={styles.expression}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {board.text}
          </Text>
        );

      case 'row': {
        const gap = spacing.sm;
        const size = clampGlyph((width - gap * (board.cells.length - 1)) / board.cells.length);
        return (
          <View style={[styles.row, { gap }]}>
            {board.cells.map((cell, index) => (
              <Glyph key={index} cell={cell} size={size} />
            ))}
          </View>
        );
      }

      case 'grid': {
        const gap = spacing.xs;
        const rows = Math.ceil(board.cells.length / board.cols);
        const byWidth = (width - gap * (board.cols - 1)) / board.cols;
        const byHeight = (height - gap * (rows - 1)) / Math.max(1, rows);
        const size = clampGlyph(Math.min(byWidth, byHeight));
        return (
          <View style={[styles.grid, { width: (size + gap) * board.cols, gap }]}>
            {board.cells.map((cell, index) => (
              <Glyph key={index} cell={cell} size={size} />
            ))}
          </View>
        );
      }

      case 'scatter': {
        // The generator places glyphs on a jittered grid of at most 6 columns by
        // 4 rows, so sizing against that keeps them from ever overlapping —
        // however little height the screen has left to give.
        const size = Math.max(14, Math.min(44, Math.floor(Math.min(width / 6.5, height / 4.6))));
        return (
          <View style={[styles.scatter, { width, height }]}>
            {board.cells.map((cell, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: cell.x * width - size / 2,
                  top: cell.y * height - size / 2,
                }}
              >
                <Glyph cell={cell as Cell} size={size} />
              </View>
            ))}
          </View>
        );
      }

      default:
        return null;
    }
  }, [board, width, height]);

  if (content === null) return null;
  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scatter: {
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  expression: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

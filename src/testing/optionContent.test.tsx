import { render, screen } from '@testing-library/react-native';

import { OptionContentView } from '../components/OptionContent';
import type { Cell, OptionContent } from '../engine';

/**
 * Option content sizing.
 *
 * A grid option's container is sized to an exact multiple of its cell size, so
 * anything that eats into that width — padding, a cell size computed from the
 * wrong axis — pushes the last glyph of each row onto a line of its own. The
 * tile has no room for the extra rows, so the shapes spill out over the tiles
 * around it. That is invisible in every puzzle whose options are a single glyph
 * or a word, which is most of them, so it is worth pinning down here.
 */

function cell(): Cell {
  return { shape: 'circle', color: 'blue', rotation: 0, filled: true, scale: 1 };
}

function gridContent(cols: number, count: number): OptionContent {
  return { kind: 'grid', cols, cells: Array.from({ length: count }, cell) };
}

/** The width the mini-grid container asks for, as laid out. */
async function containerWidth(
  content: OptionContent,
  width: number,
  height: number,
): Promise<number> {
  await render(<OptionContentView content={content} width={width} height={height} />);
  const root = screen.getByTestId('option-mini-grid');
  const style = Array.isArray(root.props.style) ? root.props.style : [root.props.style];
  const merged = Object.assign({}, ...style.filter(Boolean)) as { width?: number };
  return merged.width ?? 0;
}

describe('grid option sizing', () => {
  it('fits a 2x2 grid inside the space it was given', async () => {
    // The budget a crowded six-option tile actually offers on a phone.
    const asked = await containerWidth(gridContent(2, 4), 142, 66);

    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThanOrEqual(142);
    // Height is the binding constraint here: two rows into 66 points.
    expect(asked).toBe(33 * 2);
  });

  it('fits a 3x2 grid inside the space it was given', async () => {
    const asked = await containerWidth(gridContent(3, 6), 142, 66);

    expect(asked).toBeLessThanOrEqual(142);
    expect(asked).toBe(33 * 3);
  });

  it('never lets a wide, short grid overflow its width', async () => {
    // One row of four into a narrow tile: width, not height, has to win.
    const asked = await containerWidth(gridContent(4, 4), 100, 66);

    expect(asked).toBeLessThanOrEqual(100);
    expect(asked).toBe(25 * 4);
  });
});

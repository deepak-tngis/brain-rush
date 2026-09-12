import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

import type { Cell, ShapeName } from '../engine';
import { colors, glyphPalette } from '../theme/theme';

/**
 * Draws one puzzle cell.
 *
 * Everything the engine produces is a `Cell`, so this component is the single
 * place shapes are rendered. Paths are authored in a 100x100 box and scaled by
 * the SVG viewBox, which keeps every glyph crisp at any size and means no layout
 * anywhere in the app depends on device pixels.
 */

const VIEWBOX = 100;
const OUTLINE_WIDTH = 9;

/** Polygon points, authored clockwise from the top in a 100x100 box. */
const POLYGONS: Partial<Record<ShapeName, string>> = {
  triangle: '50,9 93,88 7,88',
  diamond: '50,5 95,50 50,95 5,50',
  hexagon: '50,5 89,27 89,73 50,95 11,73 11,27',
  pentagon: '50,5 95,38 78,92 22,92 5,38',
};

const PATHS: Partial<Record<ShapeName, string>> = {
  star: 'M50 4 L61.8 35.6 L95.1 37.8 L69.4 59.2 L77.6 91.5 L50 73.4 L22.4 91.5 L30.6 59.2 L4.9 37.8 L38.2 35.6 Z',
  heart:
    'M50 91 C50 91 6 63.5 6 36.5 C6 20.8 18 9 32.5 9 C41.2 9 48 13.6 50 20 C52 13.6 58.8 9 67.5 9 C82 9 94 20.8 94 36.5 C94 63.5 50 91 50 91 Z',
  cross: 'M38 6 H62 V38 H94 V62 H62 V94 H38 V62 H6 V38 H38 Z',
  arrow: 'M50 5 L86 47 H66 V95 H34 V47 H14 Z',
  flag: 'M22 6 H30 V94 H22 Z M30 10 H88 L72 32 L88 54 H30 Z',
};

export interface GlyphProps {
  readonly cell: Cell;
  /** Box size in points; the glyph is drawn to fill it, scaled by `cell.scale`. */
  readonly size: number;
}

function GlyphShape({ cell, size }: GlyphProps): React.ReactElement | null {
  const tint = glyphPalette[cell.color];
  const fill = cell.filled ? tint : 'none';
  const stroke = cell.filled ? 'none' : tint;
  const strokeWidth = cell.filled ? 0 : OUTLINE_WIDTH;

  const polygon = POLYGONS[cell.shape];
  const path = PATHS[cell.shape];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      <G
        rotation={cell.rotation}
        origin={`${VIEWBOX / 2}, ${VIEWBOX / 2}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      >
        {cell.shape === 'circle' ? <Circle cx={50} cy={50} r={44} /> : null}
        {cell.shape === 'square' ? (
          <Rect x={7} y={7} width={86} height={86} rx={12} ry={12} />
        ) : null}
        {polygon !== undefined ? <Polygon points={polygon} /> : null}
        {path !== undefined ? <Path d={path} /> : null}
      </G>
    </Svg>
  );
}

function GlyphComponent({ cell, size }: GlyphProps): React.ReactElement {
  const box = Math.round(size * cell.scale);

  // A hidden cell is the gap the player is being asked to fill.
  if (cell.hidden === true) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={[styles.placeholder, { fontSize: Math.round(size * 0.52) }]}>?</Text>
      </View>
    );
  }

  // 'blank' carries text only: numbers, symbols and operators.
  if (cell.shape === 'blank') {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.label,
            {
              fontSize: Math.round(size * 0.42 * cell.scale),
              color: cell.muted === true ? colors.textFaint : colors.text,
            },
          ]}
        >
          {cell.label ?? ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GlyphShape cell={cell} size={box} />
      {cell.label !== undefined ? (
        <Text style={[styles.overlayLabel, { fontSize: Math.round(box * 0.34) }]}>
          {cell.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholder: {
    color: colors.primary,
    fontWeight: '900',
  },
  overlayLabel: {
    color: colors.white,
    fontWeight: '800',
    position: 'absolute',
  },
});

export const Glyph = memo(GlyphComponent);

import { StyleSheet, Text, View } from 'react-native';

import { Glyph } from './Glyph';
import type { OptionContent } from '../engine';
import { colors } from '../theme/theme';

/**
 * Draws whatever an answer option contains: a word, a single glyph, or a small
 * grid of them.
 *
 * Shared between the option tiles and the answer reveal on purpose. The reveal
 * is only convincing if the answer it shows is visibly the *same object* the
 * player was choosing between a moment ago, which means one renderer rather
 * than two that drift apart.
 */
export function OptionContentView({
  content,
  width,
  height,
  textStyle,
}: {
  content: OptionContent;
  /** Drawable width available inside the container, in points. */
  width: number;
  /** Drawable height available inside the container, in points. */
  height: number;
  textStyle?: React.ComponentProps<typeof Text>['style'];
}): React.ReactElement {
  if (content.kind === 'text') {
    return (
      <Text
        style={[styles.text, textStyle]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {content.text}
      </Text>
    );
  }

  if (content.kind === 'cell') {
    return <Glyph cell={content.cell} size={Math.min(width, height, 56)} />;
  }

  // Width and height are budgeted separately. Collapsing them into a single
  // number undersizes wide, short grids, and the container below is sized in
  // exact multiples of the result — so this has to be the real per-axis fit.
  const rows = Math.ceil(content.cells.length / content.cols);
  const cellSize = Math.min(width / content.cols, height / rows, 34);
  return (
    <View
      testID="option-mini-grid"
      style={[styles.miniGrid, { width: cellSize * content.cols }]}
    >
      {content.cells.map((cell, index) => (
        <Glyph key={index} cell={cell} size={cellSize} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    // Deliberately no padding. The container's width is set to exactly
    // `cellSize * cols`, and React Native's border-box sizing would take any
    // padding out of that — leaving too little room for a full row of glyphs,
    // which wraps them one per line and spills them out of the tile.
  },
});

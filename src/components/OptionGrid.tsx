import { useCallback } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { PuzzleOption } from '../engine';
import { colors, elevation, radii, spacing } from '../theme/theme';
import { Glyph } from './Glyph';
import { PressableScale } from './PressableScale';

export type OptionFeedback = 'idle' | 'correct' | 'wrong' | 'revealed';

export interface OptionGridProps {
  readonly options: readonly PuzzleOption[];
  readonly layout: 'grid' | 'list';
  readonly onSelect: (optionId: string) => void;
  /** Per-option feedback state, keyed by option id. */
  readonly feedback: Readonly<Record<string, OptionFeedback>>;
  readonly disabled: boolean;
}

const FEEDBACK_STYLE: Record<OptionFeedback, { border: string; background: string }> = {
  idle: { border: colors.border, background: colors.surface },
  correct: { border: colors.success, background: colors.successSoft },
  wrong: { border: colors.danger, background: colors.dangerSoft },
  revealed: { border: colors.orange, background: '#fff4e5' },
};

export function OptionGrid({
  options,
  layout,
  onSelect,
  feedback,
  disabled,
}: OptionGridProps): React.ReactElement {
  const { width } = useWindowDimensions();

  // Two columns on a phone, three when there is genuinely room, one for lists.
  const columns = layout === 'list' ? 1 : width >= 600 ? 3 : 2;
  const gap = spacing.md;
  const horizontalPadding = spacing.lg * 2;
  const tileWidth = (width - horizontalPadding - gap * (columns - 1)) / columns;

  // Six options mean three rows on a phone, so the tiles have to give height
  // back to the puzzle board rather than pushing it off the screen.
  const crowded = options.length > 4 && layout === 'grid';
  const tileHeight =
    layout === 'list'
      ? 56
      : Math.min(crowded ? 78 : 104, Math.max(crowded ? 66 : 82, tileWidth * (crowded ? 0.5 : 0.68)));

  const renderContent = useCallback(
    (option: PuzzleOption) => {
      const { content } = option;

      if (content.kind === 'text') {
        return (
          <Text
            style={styles.optionText}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {content.text}
          </Text>
        );
      }

      if (content.kind === 'cell') {
        return <Glyph cell={content.cell} size={Math.min(tileHeight - 24, 56)} />;
      }

      const rows = Math.ceil(content.cells.length / content.cols);
      const cellSize = Math.min(
        (tileWidth - spacing.lg) / content.cols,
        (tileHeight - spacing.md) / rows,
        34,
      );
      return (
        <View style={[styles.miniGrid, { width: cellSize * content.cols }]}>
          {content.cells.map((cell, index) => (
            <Glyph key={index} cell={cell} size={cellSize} />
          ))}
        </View>
      );
    },
    [tileHeight, tileWidth],
  );

  return (
    <View style={[styles.container, { gap }]}>
      {options.map((option) => {
        const state = feedback[option.id] ?? 'idle';
        const tone = FEEDBACK_STYLE[state];
        return (
          <PressableScale
            key={option.id}
            onPress={() => onSelect(option.id)}
            disabled={disabled}
            silent
            accessibilityRole="radio"
            accessibilityState={{ selected: state !== 'idle' }}
            style={[
              styles.option,
              elevation('low'),
              {
                width: tileWidth,
                height: tileHeight,
                borderColor: tone.border,
                backgroundColor: tone.background,
                borderWidth: state === 'idle' ? 1 : 2,
              },
            ]}
          >
            {renderContent(option)}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  option: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  optionText: {
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
  },
});

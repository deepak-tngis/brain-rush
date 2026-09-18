import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { PuzzleOption } from '../engine';
import { colors, elevation, radii, spacing } from '../theme/theme';
import { OptionContentView } from './OptionContent';
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

function OptionGridComponent({
  options,
  layout,
  onSelect,
  feedback,
  disabled,
}: OptionGridProps): React.ReactElement {
  const { width, height } = useWindowDimensions();

  // Two columns on a phone, three when there is genuinely room, one for lists.
  const columns = layout === 'list' ? 1 : width >= 600 ? 3 : 2;
  const gap = spacing.md;
  const horizontalPadding = spacing.lg * 2;
  const tileWidth = (width - horizontalPadding - gap * (columns - 1)) / columns;

  /**
   * Vertical room matters as much as horizontal.
   *
   * Tile height used to be derived from tile *width* alone. On a 360x640dp
   * budget phone that produced 104pt tiles, two rows of which left the puzzle
   * area too little height — and because the stage is a flex child, it did not
   * clip but overflowed, printing the puzzle title straight over the timer
   * bars. Short screens get shorter tiles so the puzzle keeps its space.
   */
  const shortScreen = height < 760;

  // Six options mean three rows on a phone, so the tiles have to give height
  // back to the puzzle board rather than pushing it off the screen.
  const crowded = options.length > 4 && layout === 'grid';
  const tallest = shortScreen ? (crowded ? 66 : 84) : crowded ? 78 : 104;
  const shortest = shortScreen ? 54 : crowded ? 66 : 82;
  const tileHeight =
    layout === 'list'
      ? shortScreen
        ? 50
        : 56
      : Math.min(tallest, Math.max(shortest, tileWidth * (crowded ? 0.5 : 0.68)));

  const contentWidth = tileWidth - spacing.lg;
  const contentHeight = tileHeight - spacing.md;

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
            <OptionContentView
              content={option.content}
              width={contentWidth}
              height={contentHeight}
            />
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
});

/** Memoised for the same reason as the board: the countdown ticks at 10 Hz. */
export const OptionGrid = memo(OptionGridComponent);

import { Platform } from 'react-native';

import type { GlyphColor } from '../engine';

/**
 * A single clean light theme, as specified. Every colour the app draws comes
 * from here so the palette can be adjusted in one place.
 */
export const colors = {
  background: '#f0f0f3',
  surface: '#ffffff',
  surfaceMuted: '#f7f7fa',
  primary: '#2f80ed',
  primaryDark: '#1f63c4',
  orange: '#ff8c1a',
  pink: '#f83f8f',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  border: '#e3e3ea',
  success: '#16a34a',
  successSoft: '#dcfce7',
  danger: '#e11d48',
  dangerSoft: '#ffe4e9',
  shadow: '#8a8aa3',
  white: '#ffffff',
} as const;

/** Palette slots used by puzzle glyphs, kept distinguishable at small sizes. */
export const glyphPalette: Record<GlyphColor, string> = {
  blue: '#2f80ed',
  orange: '#ff8c1a',
  pink: '#f83f8f',
  green: '#16a34a',
  purple: '#8b5cf6',
  yellow: '#eab308',
  teal: '#14b8a6',
  red: '#e11d48',
};

/** Human-readable names, used in explanations read out to the player. */
export const glyphColorNames: Record<GlyphColor, string> = {
  blue: 'blue',
  orange: 'orange',
  pink: 'pink',
  green: 'green',
  purple: 'purple',
  yellow: 'yellow',
  teal: 'teal',
  red: 'red',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontSize: 19, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;

/**
 * Elevation. Android ignores iOS shadow props and vice versa, so both are
 * supplied and the platform uses whichever it understands.
 */
export function elevation(level: 'low' | 'medium' | 'high') {
  const config = {
    low: { elevation: 2, radius: 6, opacity: 0.1, offset: 2 },
    medium: { elevation: 5, radius: 12, opacity: 0.13, offset: 5 },
    high: { elevation: 10, radius: 22, opacity: 0.18, offset: 10 },
  }[level];

  return Platform.select({
    android: { elevation: config.elevation },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: config.opacity,
      shadowRadius: config.radius,
      shadowOffset: { width: 0, height: config.offset },
    },
  });
}

import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors } from '../theme/theme';

/**
 * The app mark: a brain outline with a bolt through it — "brain" plus "rush",
 * drawn as vectors so it stays sharp at any size and adds nothing to the bundle.
 */
export function BrainLogo({ size = 96 }: { size?: number }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={56} fill={colors.primary} opacity={0.1} />
      <G stroke={colors.primary} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M46 30 C33 30 25 39 25 49 C18 53 16 62 21 69 C17 77 22 87 32 88 C36 95 47 97 53 91 L53 30 C51 28 48 30 46 30 Z" />
        <Path d="M74 30 C87 30 95 39 95 49 C102 53 104 62 99 69 C103 77 98 87 88 88 C84 95 73 97 67 91 L67 30 C69 28 72 30 74 30 Z" />
        <Path d="M60 26 L60 96" opacity={0.35} />
      </G>
      <Path
        d="M66 42 L48 68 H60 L54 88 L74 60 H62 Z"
        fill={colors.orange}
        stroke={colors.white}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

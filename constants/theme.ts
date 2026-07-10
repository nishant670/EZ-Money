/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const palette = {
  backgroundLight: '#FDF5F7', // Light pinkish background
  backgroundDark: '#1A1A1A',
  textLight: '#2D2D2D',
  textDark: '#FAFAFA',
  accent: '#FF8865', // Orange primary
  accentSecondary: '#FFE8E5', // Light orange/pink card bg
  cardLight: '#FFFFFF',
  borderLight: '#F0E5E7',
  borderDark: '#3C3C3C',
};

export const Colors = {
  light: {
    text: palette.textLight,
    background: palette.backgroundLight,
    tint: palette.accent,
    accent: palette.accent,
    secondary: palette.accentSecondary,
    card: palette.cardLight,
    icon: palette.textLight,
    border: palette.borderLight,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: palette.accent,
  },
  dark: {
    text: palette.textDark,
    background: palette.backgroundDark,
    tint: palette.accent,
    accent: palette.accent,
    secondary: '#2C2C2C',
    card: '#242424',
    icon: palette.textDark,
    border: palette.borderDark,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: palette.accent,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'Times New Roman',
    rounded: 'SF Pro Rounded',
    mono: 'SFMono-Regular',
    title: 'Inter-SemiBold',
    body: 'Inter-Regular',
  },
  default: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Manrope',
    mono: 'monospace',
    title: 'Inter-SemiBold',
    body: 'Inter-Regular',
  },
  web: {
    sans: "'Inter', 'SF Pro Text', 'Manrope', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Inter', 'SF Pro Text', 'Manrope', serif",
    rounded: "'SF Pro Rounded', 'Manrope', 'Inter', sans-serif",
    mono: "'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
    title: "'Inter', 'SF Pro Display', 'Manrope', sans-serif",
    body: "'Inter', 'SF Pro Text', 'Manrope', sans-serif",
  },
});

export const Typography = {
  screenTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    fontFamily: Fonts.title,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    fontFamily: Fonts.title,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Fonts.title,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  bodyStrong: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    fontFamily: Fonts.title,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.body,
  },
  captionStrong: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: Fonts.title,
  },
  micro: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    fontFamily: Fonts.title,
  },
  button: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    fontFamily: Fonts.title,
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    fontFamily: Fonts.title,
  },
  amountHero: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    fontFamily: Fonts.title,
  },
} as const;

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  round: 999,
} as const;

export const Shadows = {
  none: {},
  soft: {
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 2,
  },
  accent: {
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 7,
  },
} as const;

export const Components = {
  screen: {
    horizontalPadding: Spacing.xxl,
    bottomPadding: 100,
  },
  card: {
    padding: Spacing.xl,
    radius: Radius.xl,
  },
  compactCard: {
    padding: Spacing.lg,
    radius: Radius.lg,
  },
  iconButton: {
    size: 40,
    radius: Radius.round,
  },
  textAction: {
    minHeight: 24,
    gap: Spacing.xs,
  },
} as const;

export type ThemeMode = keyof typeof Colors;
export type TypographyVariant = keyof typeof Typography;

export function getThemeTokens(mode: ThemeMode) {
  return {
    colors: Colors[mode],
    typography: Typography,
    spacing: Spacing,
    radius: Radius,
    shadows: Shadows,
    components: Components,
    mode,
  };
}

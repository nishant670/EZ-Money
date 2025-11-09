/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const palette = {
  backgroundLight: '#FAFAFA',
  backgroundDark: '#1A1A1A',
  textLight: '#1A1A1A',
  textDark: '#FAFAFA',
  accent: '#A3B8A2',
  borderLight: '#D9D9D9',
  borderDark: '#3C3C3C',
};

export const Colors = {
  light: {
    text: palette.textLight,
    background: palette.backgroundLight,
    tint: palette.accent,
    accent: palette.accent,
    icon: palette.textLight,
    border: palette.borderLight,
    tabIconDefault: palette.accent,
    tabIconSelected: palette.textLight,
  },
  dark: {
    text: palette.textDark,
    background: palette.backgroundDark,
    tint: palette.accent,
    accent: palette.accent,
    icon: palette.textDark,
    border: palette.borderDark,
    tabIconDefault: palette.accent,
    tabIconSelected: palette.textDark,
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

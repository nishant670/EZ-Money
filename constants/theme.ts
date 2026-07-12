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

type MoodPalette = {
  id: string;
  label: string;
  message: string;
  preview: string;
  accent: string;
  light: {
    background: string;
    text: string;
    secondary: string;
    card: string;
    border: string;
  };
  dark: {
    background: string;
    text: string;
    secondary: string;
    card: string;
    border: string;
  };
};

export const ThemeMoods = {
  finnri: {
    id: 'finnri',
    label: 'Finnri',
    message: 'The current Finnri look stays as your default.',
    preview: palette.backgroundLight,
    accent: palette.accent,
    light: {
      background: palette.backgroundLight,
      text: palette.textLight,
      secondary: palette.accentSecondary,
      card: palette.cardLight,
      border: palette.borderLight,
    },
    dark: {
      background: palette.backgroundDark,
      text: palette.textDark,
      secondary: '#2C2C2C',
      card: '#242424',
      border: palette.borderDark,
    },
  },
  mint: {
    id: 'mint',
    label: 'Mint',
    message: 'Fresh green accents for a quieter money dashboard.',
    preview: '#EAF8F1',
    accent: '#17A978',
    light: {
      background: '#F3FBF7',
      text: '#182C24',
      secondary: '#DDF6EA',
      card: '#FFFFFF',
      border: '#D7EEE3',
    },
    dark: {
      background: '#0F1D19',
      text: '#F1FFF8',
      secondary: '#17362B',
      card: '#162621',
      border: '#28483D',
    },
  },
  sky: {
    id: 'sky',
    label: 'Sky',
    message: 'Cool blue surfaces for a crisp planning feel.',
    preview: '#EAF4FC',
    accent: '#2F80ED',
    light: {
      background: '#F4F9FE',
      text: '#172437',
      secondary: '#DCEEFF',
      card: '#FFFFFF',
      border: '#D7E7F7',
    },
    dark: {
      background: '#101A25',
      text: '#F2F8FF',
      secondary: '#172C42',
      card: '#172331',
      border: '#29425E',
    },
  },
  plum: {
    id: 'plum',
    label: 'Plum',
    message: 'Warmer contrast with richer highlight moments.',
    preview: '#F5ECF7',
    accent: '#A855F7',
    light: {
      background: '#FCF6FD',
      text: '#2E2134',
      secondary: '#F0DDF8',
      card: '#FFFFFF',
      border: '#EBDCF0',
    },
    dark: {
      background: '#1F1724',
      text: '#FFF6FF',
      secondary: '#35213F',
      card: '#291E30',
      border: '#47304F',
    },
  },
} as const satisfies Record<string, MoodPalette>;

export type ThemeMoodId = keyof typeof ThemeMoods;
export type IconStyle = 'whimsical' | 'minimal';

export type AppMoodSettings = {
  themeColor: ThemeMoodId;
  nightMode: boolean;
  iconStyle: IconStyle;
};

export const DefaultAppMood: AppMoodSettings = {
  themeColor: 'finnri',
  nightMode: false,
  iconStyle: 'whimsical',
};

function createColors(mood: MoodPalette) {
  return {
    light: {
      text: mood.light.text,
      background: mood.light.background,
      tint: mood.accent,
      accent: mood.accent,
      secondary: mood.light.secondary,
      card: mood.light.card,
      icon: mood.light.text,
      border: mood.light.border,
      tabIconDefault: '#9BA1A6',
      tabIconSelected: mood.accent,
    },
    dark: {
      text: mood.dark.text,
      background: mood.dark.background,
      tint: mood.accent,
      accent: mood.accent,
      secondary: mood.dark.secondary,
      card: mood.dark.card,
      icon: mood.dark.text,
      border: mood.dark.border,
      tabIconDefault: '#9BA1A6',
      tabIconSelected: mood.accent,
    },
  };
}

type ThemeColors = ReturnType<typeof createColors>;

let runtimeAppMood: AppMoodSettings = DefaultAppMood;

export function setRuntimeAppMood(mood: Partial<AppMoodSettings>) {
  runtimeAppMood = { ...runtimeAppMood, ...mood };
}

export function getRuntimeAppMood() {
  return runtimeAppMood;
}

const defaultColors = createColors(ThemeMoods.finnri);

export const Colors = new Proxy(defaultColors, {
  get(target, prop: keyof ThemeColors) {
    if (prop === 'light' || prop === 'dark') {
      return getMoodColors(runtimeAppMood.themeColor)[prop];
    }

    return target[prop];
  },
}) as ThemeColors;

const outlineIconNames: Record<string, string> = {
  account: 'account-outline',
  'account-box': 'account-box-outline',
  bank: 'bank-outline',
  bell: 'bell-outline',
  cash: 'cash',
  'chart-bar': 'chart-bar',
  'check-circle': 'check-circle-outline',
  'credit-card': 'credit-card-outline',
  help: 'help-circle-outline',
  home: 'home-outline',
  information: 'information-outline',
  login: 'login',
  logout: 'logout',
  pencil: 'pencil-outline',
  'piggy-bank': 'piggy-bank-outline',
  robot: 'robot-outline',
  'shield-check': 'shield-check-outline',
  sync: 'sync',
  wallet: 'wallet-outline',
};

const filledIconNames: Record<string, string> = {
  'account-outline': 'account',
  'account-box-outline': 'account-box',
  'bank-outline': 'bank',
  'bell-outline': 'bell',
  'check-circle-outline': 'check-circle',
  'credit-card-outline': 'credit-card',
  'help-circle-outline': 'help-circle',
  'home-outline': 'home',
  'information-outline': 'information',
  'pencil-outline': 'pencil',
  'piggy-bank-outline': 'piggy-bank',
  'robot-outline': 'robot',
  'shield-check-outline': 'shield-check',
  'wallet-outline': 'wallet',
};

export function getMoodIconName(name: string, iconStyle: IconStyle, active = false) {
  if (iconStyle === 'minimal') {
    return outlineIconNames[name] ?? name;
  }

  return active ? filledIconNames[name] ?? name : name;
}

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

export function resolveThemeMode(
  systemMode: ThemeMode | null | undefined,
  mood: Pick<AppMoodSettings, 'nightMode'> = DefaultAppMood
): ThemeMode {
  return mood.nightMode ? 'dark' : 'light';
}

export function getMoodColors(themeColor: ThemeMoodId = DefaultAppMood.themeColor) {
  return createColors(ThemeMoods[themeColor] ?? ThemeMoods[DefaultAppMood.themeColor]);
}

export function getThemeTokens(mode: ThemeMode, mood: AppMoodSettings = DefaultAppMood) {
  const colors = getMoodColors(mood.themeColor);
  const icon = {
    style: mood.iconStyle,
    containerRadius: mood.iconStyle === 'minimal' ? Radius.sm : Radius.round,
    activeContainerRadius: mood.iconStyle === 'minimal' ? Radius.md : Radius.xl,
    strokeBias: mood.iconStyle === 'minimal' ? 'outline' : 'filled',
  } as const;

  return {
    colors: colors[mode],
    typography: Typography,
    spacing: Spacing,
    radius: Radius,
    shadows: Shadows,
    components: Components,
    mood,
    icon,
    mode,
  };
}

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

/**
 * The ratio every preset above is drawn at, and the one a size override is
 * given when it does not bring a line height of its own.
 *
 * A `lineHeight` smaller than the glyphs need does not overflow — it *clips*,
 * at the bottom of the line box, which on a money screen is not cosmetic:
 * digits have no descenders but the grouping comma does, so `₹40,486` loses
 * the comma's tail and reads as `₹40.486`. Inter needs about 1.21x its font
 * size; 1.3 is that plus the leading the presets already sit at (they run
 * 1.26-1.5, and the two display sizes that were hand-tuned on a handset landed
 * at 1.26 and 1.33).
 */
export const LineHeightRatio = 1.3;

/** The line height a given font size wants, absent an explicit one. */
export function derivedLineHeight(fontSize: number): number {
  return Math.round(fontSize * LineHeightRatio);
}

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

/**
 * Motion tokens — the shared timing vocabulary.
 *
 * Every animation in the app was tuned by hand and none of them matched: the
 * bottom sheet entered over 240ms, the save toast over 180ms, the mic ring over
 * 260ms, and nothing chose those numbers for a reason. These are the numbers to
 * choose from now. New animation reads a token; it does not invent a duration.
 *
 * Pure data on purpose — no Reanimated import, so this file stays usable from
 * legacy `Animated`, from Reanimated worklets, and from the CSS animation API,
 * all of which want the same curve in a different shape. `useMotion()` in
 * `hooks/use-motion.ts` is the Reanimated-flavoured reader, and the one that
 * applies the reduced-motion degrade.
 *
 * ## Why exits are derived rather than listed
 *
 * A leaving element is already gone as far as the user is concerned, so making
 * them wait out an entrance-length curve reads as lag. That rule is worth more
 * as structure than as a convention nobody remembers, so there is no
 * `duration.sheetExit` to get out of step — exit durations come from
 * `EXIT_RATIO` applied to the entry duration, and are therefore always faster.
 */
export const Motion = {
  duration: {
    /** Press states, chip selection, toggles. */
    instant: 120,
    /** Cards, list items, collapse/expand. */
    base: 220,
    /** Bottom sheets, modals, screen pushes. */
    sheet: 320,
  },
  ease: {
    /** Anything entering or moving. Cubic-bezier control points. */
    standard: [0.22, 1, 0.36, 1],
    /** Anything leaving. */
    exit: [0.4, 0, 1, 1],
  },
  spring: {
    /** Buttons, FAB, mic. */
    press: { damping: 18, stiffness: 260 },
  },
  stagger: {
    /**
     * Feed and list entrance. `step` per row; `max` rows carry a distinct
     * delay, and everything past that shares the last one — an 80-row feed
     * staggered honestly would still be arriving two seconds later.
     */
    list: { step: 28, max: 8 },
    /**
     * Fields settling into a form. Slower per item than a list because there
     * are far fewer of them and each is read rather than scanned, and capped
     * low for the same reason — a draft that takes half a second to assemble
     * has stopped being feedback and started being a wait.
     */
    fields: { step: 40, max: 6 },
  },
} as const;

/** An exit is this fraction of the matching entry. See the note on `Motion`. */
export const EXIT_RATIO = 0.75;

export type MotionDurationToken = keyof typeof Motion.duration;
export type MotionEaseToken = keyof typeof Motion.ease;
export type EaseCurve = readonly [number, number, number, number];

/** The same curve as a CSS timing function, for Reanimated's CSS animations. */
export function cubicBezier(curve: EaseCurve): string {
  return `cubic-bezier(${curve.join(',')})`;
}

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
    motion: Motion,
    components: Components,
    mood,
    icon,
    mode,
  };
}

import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import {
  Fonts,
  Typography,
  derivedLineHeight,
  type TypographyVariant,
} from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  variant?: TypographyVariant;
};

/**
 * The line height an override needs, or `undefined` if the preset's will do.
 *
 * A preset here carries a `fontSize` *and* a `lineHeight`, but a caller's
 * override almost never carries both: `text-[30px]` compiles to `fontSize`
 * alone (Tailwind pairs a line height with its *named* sizes only, so
 * `text-lg` is safe and `text-[18px]` is not), and an inline
 * `style={{ fontSize: 18 }}` is the same trap spelled out. The preset's line
 * height then survives the override and boxes a larger glyph than it was
 * measured for, which clips — see `LineHeightRatio`.
 *
 * It only ever *grows* the box. Most overrides in the app are smaller than the
 * preset — `text-[10px]` and `text-[11px]` are 134 of the 148 — and those sit
 * in a roomy line box rather than a clipping one, so returning a derived
 * height for them would re-space a third of the app's text to fix nothing.
 * The rule is `max(preset, derived)`, expressed as "speak only when short".
 */
export function resolveLineHeight(
  preset: TextStyle | undefined,
  override: StyleProp<TextStyle>
): number | undefined {
  const presetLineHeight = preset?.lineHeight;
  // A preset without a line height leaves the platform to measure the line,
  // which it does against the font actually in use. Nothing to outgrow.
  if (typeof presetLineHeight !== 'number') return undefined;

  const flat = StyleSheet.flatten(override) as TextStyle | undefined;
  // An explicit line height is an answer, not an omission. Deliberately checked
  // before the font size: `style={{ lineHeight }}` with no size is a caller
  // re-spacing the preset, and that must survive too.
  if (typeof flat?.lineHeight === 'number') return undefined;
  if (typeof flat?.fontSize !== 'number') return undefined;

  const derived = derivedLineHeight(flat.fontSize);
  return derived > presetLineHeight ? derived : undefined;
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  variant,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const accent = useThemeColor({}, 'tint');
  const preset: TextStyle = variant ? Typography[variant] : styles[type];
  const lineHeight = resolveLineHeight(preset, style);

  return (
    <Text
      style={[
        { color },
        preset,
        !variant && type === 'link' ? { color: accent } : undefined,
        style,
        // Last, so it wins over the preset — and only ever present when the
        // caller left the question open.
        lineHeight === undefined ? undefined : { lineHeight },
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  defaultSemiBold: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    fontFamily: Fonts.title,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // 30 until X14: the one preset that was itself clipping, at a ratio of
    // 1.07. `Typography.amountHero` is the house pair for this size.
    lineHeight: 34,
    fontFamily: Fonts.title,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Fonts.title,
  },
  link: {
    lineHeight: 22,
    fontSize: 14,
    fontFamily: Fonts.body,
  },
});

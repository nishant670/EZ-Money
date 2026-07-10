import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Typography, type TypographyVariant } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  variant?: TypographyVariant;
};

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
  const variantStyle = variant ? Typography[variant] : undefined;

  return (
    <Text
      style={[
        { color },
        variantStyle ?? (type === 'default' ? styles.default : undefined),
        !variant && type === 'title' ? styles.title : undefined,
        !variant && type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        !variant && type === 'subtitle' ? styles.subtitle : undefined,
        !variant && type === 'link' ? [styles.link, { color: accent }] : undefined,
        style,
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
    lineHeight: 30,
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

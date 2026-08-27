import { MaterialCommunityIcons } from '@expo/vector-icons';
import type React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onRightPress?: () => void;
  rightNode?: React.ReactNode;
  style?: ViewStyle;
};

export function AppHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightNode,
  style,
}: AppHeaderProps) {
  const theme = useThemeTokens();
  const colors = theme.colors;

  return (
    <View
      /*
       * The padding is a style rather than `px-6 py-4`, so that a caller can
       * turn it off. Tailwind's `px-*` compiles to `paddingLeft`/`paddingRight`,
       * and Yoga reads a longhand as more specific than the `paddingHorizontal`
       * an override would naturally reach for — so the override lost and the
       * Split header sat at 48pt while every other screen sat at 24. Same
       * shorthand on both sides means the last one written wins, which is what
       * an override is for.
       */
      className="flex-row items-center"
      style={[
        { backgroundColor: colors.background, paddingHorizontal: 24, paddingVertical: 16 },
        style,
      ]}>
      {onBack && (
        <Pressable
          onPress={onBack}
          className="mr-4 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.card }}
          hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
      )}

      <View className="min-w-0 flex-1">
        <ThemedText
          numberOfLines={1}
          className="text-xl font-black"
          style={{ color: colors.text, fontFamily: Fonts.title }}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText numberOfLines={1} className="mt-0.5 text-xs" style={{ color: `${colors.text}99` }}>
            {subtitle}
          </ThemedText>
        )}
      </View>

      {rightNode ??
        (rightIcon ? (
          <Pressable
            onPress={onRightPress}
            className="ml-4 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.card }}
            hitSlop={12}>
            <MaterialCommunityIcons name={rightIcon} size={22} color={colors.accent} />
          </Pressable>
        ) : (
          <View className="ml-4 h-10 w-10" />
        ))}
    </View>
  );
}

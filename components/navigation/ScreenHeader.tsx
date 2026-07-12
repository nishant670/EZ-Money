import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack: () => void;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  rightText?: string;
  onRightPress?: () => void;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  rightText,
  onRightPress,
}: ScreenHeaderProps) {
  const theme = useThemeTokens();

  return (
    <View className="flex-row items-center justify-between mb-8 px-6 pt-4">
      <Pressable
        onPress={onBack}
        className="h-10 w-10 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: theme.colors.card }}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
      </Pressable>

      <View className="items-center flex-1">
        {subtitle && (
          <ThemedText
            className="text-[10px] font-black uppercase tracking-[2px] mb-1"
            style={{ color: theme.colors.accent }}>
            {subtitle}
          </ThemedText>
        )}
        {title && (
          <ThemedText
            className="text-base font-black"
            style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
            {title}
          </ThemedText>
        )}
      </View>

      {rightIcon || rightText ? (
        <Pressable
          onPress={onRightPress}
          className={`h-10 items-center justify-center rounded-full bg-white/50 ${rightText ? 'px-4' : 'w-10'}`}>
          {rightIcon ? (
            <MaterialCommunityIcons name={rightIcon} size={24} color="#AAB7C6" />
          ) : (
            <ThemedText className="text-sm font-black" style={{ color: '#AAB7C6' }}>
              {rightText}
            </ThemedText>
          )}
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

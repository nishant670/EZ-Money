import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import type { useThemeTokens } from '@/hooks/use-theme-tokens';

type PanelActionRowProps = {
  subtitle: string;
  actionLabel?: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onAction?: () => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

/**
 * What a panel shows in place of its own header inside the Money tab.
 *
 * Each of these screens used to own a full `AppHeader` with a title and a back
 * arrow. Embedded, the title would repeat what the segment pill already says
 * and the back arrow would leave the tab entirely — so the panel keeps only
 * the two things the header was actually carrying: a line of state and its
 * primary action.
 */
export function PanelActionRow({
  subtitle,
  actionLabel,
  actionIcon = 'plus',
  onAction,
  colors,
}: PanelActionRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-4 px-6 pb-1">
      <ThemedText
        numberOfLines={2}
        className="min-w-0 flex-1 text-sm"
        style={{ color: `${colors.text}99`, fontFamily: Fonts.body }}>
        {subtitle}
      </ThemedText>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          className="h-11 flex-row items-center gap-1.5 rounded-full px-4"
          style={{ backgroundColor: colors.accent }}>
          <MaterialCommunityIcons name={actionIcon} size={18} color="#FFFFFF" />
          <ThemedText
            className="text-sm"
            style={{ color: '#FFFFFF', fontFamily: Fonts.title }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

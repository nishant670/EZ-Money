import { ThemedText } from '@/components/themed-text';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { FinnriLogoMark } from '@/components/FinnriLogoMark';
import { userDisplayName } from '@/lib/display-name';

type HomeHeaderProps = {
  unreadCount?: number;
  onNotificationsPress?: () => void;
};

export function HomeHeader({ unreadCount = 0, onNotificationsPress }: HomeHeaderProps) {
  const theme = useThemeTokens();
  const { user } = useAuthStore();
  const displayName = `${userDisplayName(user?.username)}!`;
  const visibleCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View className="flex-row items-center justify-between px-6 pt-2 pb-6">
      <View className="flex-row items-center gap-3">
        {/* Finnri Logo - Brand Identity */}
        <FinnriLogoMark size={48} style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }} />

        <View>
          <ThemedText className="text-xs text-black/60 dark:text-white/60">Hey there,</ThemedText>
          <ThemedText variant="sectionTitle" style={{ color: theme.colors.text }}>
            {displayName}
          </ThemedText>
        </View>
      </View>

      <Pressable
        onPress={onNotificationsPress}
        className="h-10 w-10 items-center justify-center rounded-full"
        hitSlop={12}>
        <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.text} />
        {unreadCount > 0 && (
          <View
            className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full px-1"
            style={{
              backgroundColor: theme.colors.accent,
              borderWidth: 2,
              borderColor: theme.mode === 'dark' ? theme.colors.background : '#FFFFFF',
            }}>
            <ThemedText
              className="text-[10px] font-black text-white"
              style={{
                width: '100%',
                textAlign: 'center',
                lineHeight: 10,
                includeFontPadding: false,
              }}>
              {visibleCount}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

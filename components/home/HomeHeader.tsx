import { ThemedText } from '@/components/themed-text';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
// Note: We'll use the local asset saved earlier
const LOGO_IMG = require('@/assets/images/logo-white.png');

type HomeHeaderProps = {
  unreadCount?: number;
  onNotificationsPress?: () => void;
};

export function HomeHeader({ unreadCount = 0, onNotificationsPress }: HomeHeaderProps) {
  const theme = useThemeTokens();
  const { user } = useAuthStore();
  const displayName = user?.username ? `${user.username}!` : 'Hey there!';
  const visibleCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View className="flex-row items-center justify-between px-6 pt-2 pb-6">
      <View className="flex-row items-center gap-3">
        {/* Finnri Logo - Brand Identity */}
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
          style={{
            backgroundColor: theme.mode === 'light' ? theme.colors.text : theme.colors.card,
          }}>
          <Image
            source={LOGO_IMG}
            className="h-8 w-8"
            resizeMode="contain"
            style={{ tintColor: '#FFF' }} // Ensuring it's white as requested
          />
        </View>

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
        <MaterialCommunityIcons name="bell" size={24} color={theme.colors.text} />
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

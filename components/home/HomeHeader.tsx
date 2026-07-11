import { ThemedText } from '@/components/themed-text';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
// Note: We'll use the local asset saved earlier
const LOGO_IMG = require('@/assets/images/logo-white.png');

export function HomeHeader() {
  const theme = useThemeTokens();
  const { user } = useAuthStore();
  const displayName = user?.username ? `${user.username}!` : 'Hey there!';

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

      <Pressable>
        <MaterialCommunityIcons name="bell" size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

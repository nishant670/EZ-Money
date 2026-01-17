import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
// Note: We'll use the local asset saved earlier
const LOGO_IMG = require('@/assets/images/logo-white.png');

export function HomeHeader() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuthStore();
  const displayName = user?.username ? `${user.username}!` : 'Hey there!';

  return (
    <View className="flex-row items-center justify-between px-6 pt-2 pb-6">
      <View className="flex-row items-center gap-3">
        {/* Finnri Logo - Brand Identity */}
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
          style={{ backgroundColor: theme.text === '#2D2D2D' ? '#2D2D2D' : theme.card }}
        >
          <Image
            source={LOGO_IMG}
            className="h-8 w-8"
            resizeMode="contain"
            style={{ tintColor: '#FFF' }} // Ensuring it's white as requested
          />
        </View>

        <View>
          <ThemedText className="text-xs text-black/60 dark:text-white/60">
            Hey there,
          </ThemedText>
          <ThemedText className="text-xl font-bold" style={{ color: theme.text }}>
            {displayName}
          </ThemedText>
        </View>
      </View>

      <Pressable>
        <MaterialCommunityIcons name="cog" size={24} color={theme.text} />
      </Pressable>
    </View>
  );
}

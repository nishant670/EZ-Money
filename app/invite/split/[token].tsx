import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/theme-primitives';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  acceptSplitGroupInvite,
  fetchSplitGroupInvite,
  type SplitGroupInviteDetails,
} from '@/lib/splits';

export default function SplitInviteScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string }>();
  const authToken = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const theme = useThemeTokens().colors;
  const [invite, setInvite] = useState<SplitGroupInviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const inviteToken = Array.isArray(routeToken) ? routeToken[0] : routeToken;

  const loadInvite = useCallback(async () => {
    if (!authToken || !inviteToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setInvite(await fetchSplitGroupInvite(authToken, inviteToken));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this invite.');
    } finally {
      setLoading(false);
    }
  }, [authToken, inviteToken]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const acceptInvite = async () => {
    if (!authToken || !inviteToken || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptSplitGroupInvite(authToken, inviteToken);
      router.replace('/(tabs)/split');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Unable to join this group.');
    } finally {
      setAccepting(false);
    }
  };

  const goToAuth = () => {
    router.replace('/auth');
  };

  return (
    <SafeAreaView className="flex-1 px-6" style={{ backgroundColor: theme.background }}>
      <View className="flex-row items-center py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close invite"
          onPress={() => router.replace('/(tabs)/split')}
          className="h-11 w-11 items-center justify-center">
          <MaterialCommunityIcons name="arrow-left" size={28} color={theme.text} />
        </Pressable>
      </View>

      <View className="flex-1 justify-center">
        <Card style={{ alignItems: 'center', padding: 28 }}>
          <View
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="account-group-outline" size={34} color={theme.accent} />
          </View>
          <ThemedText
            className="mt-5 text-center text-2xl"
            style={{ color: theme.text, fontFamily: Fonts.title }}>
            {invite ? `Join ${invite.group.name}` : 'Split group invite'}
          </ThemedText>
          <ThemedText className="mt-3 text-center text-base leading-6 text-black/55 dark:text-white/55">
            {invite
              ? `${invite.owner_name} invited you to track shared expenses with ${invite.member_count} people on Finnri.`
              : 'Open this invite while signed in to Finnri.'}
          </ThemedText>

          {loading ? <ActivityIndicator className="mt-6" color={theme.accent} /> : null}
          {error ? (
            <ThemedText className="mt-5 text-center text-sm text-red-500">{error}</ThemedText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading || accepting}
            onPress={user ? acceptInvite : goToAuth}
            className="mt-7 min-h-14 w-full items-center justify-center rounded-2xl px-5"
            style={{ backgroundColor: theme.accent, opacity: loading || accepting ? 0.65 : 1 }}>
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText className="text-base text-white" style={{ fontFamily: Fonts.title }}>
                {user ? 'Join group' : 'Sign in to join'}
              </ThemedText>
            )}
          </Pressable>
        </Card>
      </View>
    </SafeAreaView>
  );
}

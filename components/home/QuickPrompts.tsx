import { ActionSheetIOS, ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/transactions';

export type QuickPrompt = {
  id: number;
  title: string;
  amount: number;
  mode: string;
  category: string;
  icon: string;
};

export function QuickPrompts({
  onSelect,
  onAdd,
  onLongPress
}: {
  onSelect: (prompt: QuickPrompt) => void;
  onAdd: () => void;
  onLongPress: (prompt: QuickPrompt) => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuthStore();

  const [prompts, setPrompts] = useState<QuickPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrompts = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/v1/quick-prompts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPrompts(data);
      }
    } catch (err) {
      console.error('Failed to fetch quick prompts', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const canAddMore = prompts.length < 10;

  return (
    <View className="py-6 flex-row items-center">
      <ThemedText className="pl-6 text-[10px] font-black uppercase tracking-widest opacity-40 mr-3">
        QUICK PROMPTS:
      </ThemedText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 24, gap: 10, alignItems: 'center' }}
      >

        {isLoading ? (
          <ActivityIndicator size="small" color={theme.accent} className="mx-2" />
        ) : (
          prompts.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item)}
              onLongPress={() => onLongPress(item)}
              className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-5 py-2 gap-2 shadow-sm active:opacity-70 border border-gray-50 dark:border-gray-700"
            >
              <MaterialCommunityIcons
                name={(item.icon || 'lightning-bolt') as any}
                size={14}
                color={theme.accent}
              />
              <ThemedText className="text-sm font-bold opacity-80">{item.title}</ThemedText>
            </Pressable>
          ))
        )}
        {!isLoading && canAddMore && (
          <Pressable
            onPress={onAdd}
            className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 gap-2 active:opacity-70"
          >
            <ThemedText className="text-xs font-bold text-gray-500">Add +</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

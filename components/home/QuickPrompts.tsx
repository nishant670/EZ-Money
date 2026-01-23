import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

const prompts = [
  { icon: 'coffee', label: 'Morning Coffee' },
  { icon: 'train', label: 'Metro Recharge' },
  { icon: 'water', label: 'Coconut Water' },
  { icon: 'taxi', label: 'Office Cab' },
  { icon: 'fuel', label: 'Car Fuel' },
];

export function QuickPrompts({ onSelect, onAdd }: { onSelect: (label: string) => void; onAdd?: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View className="py-6">
      <View className="flex-row items-center px-6 mb-3">
        <ThemedText className="text-xs font-bold uppercase tracking-widest opacity-40">
          QUICK PROMPTS:
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        >
          {prompts.map((item, index) => (
            <Pressable
              key={index}
              onPress={() => onSelect(item.label)}
              className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-2 gap-2 shadow-sm active:opacity-70"
            >
              <MaterialCommunityIcons name={item.icon as any} size={16} color={theme.text} opacity={0.6} />
              <ThemedText className="text-sm font-medium opacity-80">{item.label}</ThemedText>
            </Pressable>
          ))}
          {/* Add Prompt Button */}
          <Pressable
            onPress={onAdd}
            className="flex-row items-center bg-transparent border border-dashed border-gray-400 dark:border-gray-600 rounded-full px-4 py-2 gap-2 active:opacity-70"
          >
            <ThemedText className="text-sm font-bold text-gray-400">Add +</ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

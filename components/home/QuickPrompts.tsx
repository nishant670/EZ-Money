import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

const prompts = [
    { icon: 'coffee', label: 'Coffee fun' },
    { icon: 'car', label: 'Ride bill' },
    { icon: 'cart', label: 'Groceries' },
    { icon: 'movie', label: 'Movies' },
];

export function QuickPrompts() {
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
                className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-2 gap-2 shadow-sm"
            >
                 <MaterialCommunityIcons name={item.icon as any} size={16} color={theme.text} opacity={0.6} />
                 <ThemedText className="text-sm font-medium opacity-80">{item.label}</ThemedText>
            </Pressable>
        ))}
      </ScrollView>
        </View>
      
      
    </View>
  );
}

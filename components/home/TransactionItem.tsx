import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

// Simplified props for UI matching
interface TransactionItemProps {
    icon: string;
    title: string;
    category: string;
    subtitle?: string;
    amount: string;
    date: string;
    isIncome?: boolean;
    onPress?: () => void;
}

export function TransactionItem({ 
    icon, 
    title, 
    category,
    subtitle,
    amount,
    date,
    isIncome,
    onPress
}: TransactionItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <Pressable 
        onPress={onPress}
        className="flex-row items-center bg-white dark:bg-gray-800 p-4 rounded-3xl mb-3 shadow-sm mx-6"
    >
      {/* Icon Box */}
      <View 
        className="h-12 w-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: isIncome ? '#E8F5E9' : '#FFEBEE' }} // Green tint / Red tint
      >
         <MaterialCommunityIcons 
            name={icon as any} 
            size={24} 
            color={isIncome ? '#27AE60' : '#E57373'} 
         />
      </View>

      {/* Details */}
      <View className="flex-1">
        <ThemedText className="text-base font-bold text-gray-800 dark:text-gray-100">
            {title}
        </ThemedText>
        <View className="flex-row items-center pt-1">
             <View className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 mr-2">
                 <ThemedText className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {category}
                 </ThemedText>
             </View>
             {subtitle && (
                <ThemedText className="text-xs text-gray-400">
                    • {subtitle}
                </ThemedText>
             )}
        </View>
      </View>

      {/* Amount & Date */}
      <View className="items-end">
        <ThemedText 
            className="text-base font-bold" 
            style={{ color: isIncome ? '#27AE60' : theme.text }}
        >
            {isIncome ? '+' : ''}{amount}
        </ThemedText>
         <ThemedText className="text-xs text-gray-400 pt-1">
            {date}
        </ThemedText>
      </View>

    </Pressable>
  );
}

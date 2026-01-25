import { ThemedText } from '@/components/themed-text';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
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
  color?: string;
  bgColor?: string;
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
  color,
  bgColor,
  isIncome,
  onPress
}: TransactionItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white dark:bg-gray-800 p-4 rounded-3xl mb-3 shadow-sm"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
      }}
    >
      {/* Icon Box */}
      <View
        className="h-12 w-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: bgColor || (isIncome ? '#E8F5E9' : '#FFEBEE') }}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={24}
          color={color || (isIncome ? '#27AE60' : '#E57373')}
        />
      </View>

      {/* Details */}
      <View className="flex-1">
        <ThemedText className="text-base font-bold text-gray-800 dark:text-gray-100">
          {title}
        </ThemedText>
        <View className="flex-row items-center pt-1">
          <View
            className="px-2.5 rounded-full mr-2"
            style={{ backgroundColor: bgColor || '#F3F4F6' }}
          >
            <ThemedText
              className="text-[10px] font-bold uppercase tracking-tight"
              style={{ color: color || '#6B7280' }}
            >
              {category}
            </ThemedText>
          </View>
          {subtitle && (
            <ThemedText className="text-xs text-gray-400 font-medium">
              • {subtitle}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Amount & Date */}
      <View className="items-end">
        <ThemedText
          className="text-base font-black"
          style={{ color: isIncome ? '#27AE60' : theme.text }}
        >
          {isIncome ? '+' : '-'}{CURRENCY_SYMBOL}{amount}
        </ThemedText>
        <ThemedText className="text-[11px] text-gray-400 font-medium pt-1">
          {date}
        </ThemedText>
      </View>

    </Pressable>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TransactionItem } from '@/components/home/TransactionItem';
import { ThemedText } from '@/components/themed-text';
import { AdvancedFilter } from '@/components/transactions/AdvancedFilter';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeColor } from '@/hooks/use-theme-color';
import { groupTransactionsBySection, loadTransactions } from '@/lib/transactions';
import { Transaction } from '@/types/transaction';

export default function TransactionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const accent = useThemeColor({}, 'accent');
  const { token } = useAuthStore();

  // Logic States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<'Expense' | 'Income' | 'Transfer' | 'All'>('All');
  const [amountRange, setAmountRange] = useState({ min: 50, max: 2500 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [activeDatePill, setActiveDatePill] = useState('This Month');


  // Initial Load
  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const mapped = await loadTransactions(token);
        setTransactions(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load transactions.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [token]);

  // Filter Logic (Simplified for Visuals, can extend later)
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return transactions.filter((txn) => {
      const matchesQuery = !query || (
        txn.name.toLowerCase().includes(query) ||
        txn.category.toLowerCase().includes(query) ||
        (txn.notes && txn.notes.toLowerCase().includes(query))
      );

      const matchesType = filterType === 'All' || txn.entryType?.toLowerCase() === filterType.toLowerCase();
      const matchesCategory = !selectedCategory || txn.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesQuery && matchesType && matchesCategory;
    });
  }, [transactions, searchQuery, filterType, selectedCategory]);

  const sections = useMemo(
    () => groupTransactionsBySection(filteredTransactions),
    [filteredTransactions],
  );

  const calculateDailyTotal = (items: Transaction[]) => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const renderTransactionCard = useCallback(
    (item: Transaction) => {
      const isIncome = item.entryType === 'income' || item.amount >= 0;
      const displayAmount = Math.abs(item.amount).toFixed(2);
      // Date formatting for subtitle or similar if needed, 
      // but the design shows specific layout. Reusing TransactionItem for consistency.

      return (
        <TransactionItem
          key={item.id}
          icon={item.icon as any}
          title={item.name}
          category={item.category} // Can swap with Merchant if available
          subtitle={`${item.category} • ${item.dateLabel?.split(',')[0]}`} // Placeholder logic
          amount={`₹${displayAmount}`}
          date="" // Hiding date in right column as per design it might be redundant or specific
          isIncome={isIncome}
          onPress={() =>
            router.push({
              pathname: '/entry/[id]',
              params: {
                id: item.id,
                name: item.name,
                category: item.category,
                amount: displayAmount,
                entryType: item.entryType ?? 'expense',
                section: item.section,
                mode: item.mode ?? '',
                notes: item.notes ?? '',
                merchant: item.merchant ?? '',
                dateLabel: item.dateLabel ?? '',
                rawDate: item.rawDate ?? '',
                tag: item.tag ?? '',
              },
            })
          }
        />
      );
    },
    [],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm">
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
        </Pressable>

        <ThemedText className="text-lg font-bold" style={{ color: theme.text }}>
          &nbsp; Your Money Story&nbsp;
        </ThemedText>
        <View></View>
      </View>

      {/* Search Bar */}
      <View className="px-6 pb-6 flex-row gap-3">
        <View className="flex-1 flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1 shadow-sm">
          <MaterialCommunityIcons name="magnify" size={20} color="#A0A0A0" />
          <TextInput
            placeholder="Search your story..."
            placeholderTextColor="#A0A0A0"
            className="flex-1 ml-2 text-base"
            style={{ color: theme.text }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable
          onPress={() => setIsFilterOpen(true)}
          className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 items-center justify-center shadow-sm active:scale-95"
        >
          <MaterialCommunityIcons name="tune-variant" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Dynamic Sections */}
        {sections.map((section) => {
          const total = calculateDailyTotal(section.data);
          const totalColor = total >= 0 ? '#27AE60' : '#808080';

          return (
            <View key={section.title} className="mb-6">
              <View className="flex-row justify-between items-center px-8 mb-3">
                <ThemedText className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {section.title.toUpperCase()}
                </ThemedText>
                <View className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg">
                  <ThemedText className="text-xs font-bold" style={{ color: totalColor }}>
                    {total >= 0 ? '+' : ''}₹{Math.abs(total).toFixed(2)}
                  </ThemedText>
                </View>
              </View>
              {section.data.map(renderTransactionCard)}
            </View>
          );
        })}

        {/* Footer */}
        <View className="items-center py-8 gap-3 opacity-50">
          <View className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center">
            <MaterialCommunityIcons name="history" size={20} color={theme.text} />
          </View>
          <ThemedText className="text-xs" style={{ color: theme.text }}>End of your story for now!</ThemedText>
        </View>

      </ScrollView>

      {/* Advanced Filters Bottom Sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={isFilterOpen}
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="absolute inset-0" onPress={() => setIsFilterOpen(false)} />
          <AdvancedFilter
            onClose={() => setIsFilterOpen(false)}
            count={filteredTransactions.length}
            onApply={(newFilters: any) => {
              setFilterType(newFilters.type as any);
              setSelectedCategory(newFilters.category);
              setSelectedMethod(newFilters.paymentMethod);
              setIsFilterOpen(false);
            }}
            currentFilters={{
              type: filterType,
              dateRange: { from: 'Jun 10', to: 'Jul 10' }, // Placeholder for now
              amountRange: amountRange,
              category: selectedCategory,
              account: null, // Mapping these as needed
              paymentMethod: selectedMethod,
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeTransactionsChanged } from '@/lib/transaction-events';
import { loadTransactions } from '@/lib/transactions';
import { Transaction } from '@/types/transaction';

const formatMoney = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const toParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const merchantInitials = (merchant: string) =>
  merchant
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'M';

const formatSectionDate = (value?: string | null) => {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.toUpperCase();
  return parsed
    .toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    })
    .toUpperCase();
};

const groupByDate = (transactions: Transaction[]) => {
  const groups = new Map<string, Transaction[]>();
  transactions.forEach((transaction) => {
    const key = formatSectionDate(transaction.rawDate ?? transaction.dateLabel);
    const existing = groups.get(key) ?? [];
    existing.push(transaction);
    groups.set(key, existing);
  });
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
};

export default function MerchantHistoryScreen() {
  const params = useLocalSearchParams();
  const merchant = toParam(params.merchant) ?? 'Merchant';
  const start = toParam(params.start);
  const end = toParam(params.end);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const loaded = await loadTransactions(token, {
          q: merchant,
          start_date: start,
          end_date: end,
          page: 1,
          page_size: 100,
        });
        setTransactions(
          loaded.filter((transaction) =>
            (transaction.merchant || transaction.name)
              .toLowerCase()
              .includes(merchant.toLowerCase())
          )
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load merchant history.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [end, merchant, start, token]
  );

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load])
  );

  useEffect(
    () =>
      subscribeTransactionsChanged(() => {
        void load(true);
      }),
    [load]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return transactions;
    return transactions.filter((transaction) =>
      [transaction.name, transaction.category, transaction.mode, transaction.accountName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [query, transactions]);

  const total = useMemo(
    () =>
      filtered
        .filter((transaction) => transaction.entryType !== 'income')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [filtered]
  );
  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  if (loading && transactions.length === 0) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon="store-search-outline"
          title="Loading merchant history"
          message={`Finding ${merchant} transactions.`}
          loading
        />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between px-5 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-800">
          <MaterialCommunityIcons name="chevron-left" size={30} color={theme.text} />
        </TouchableOpacity>
        <ThemedText className="text-lg font-black">Merchant History</ThemedText>
        <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-800">
          <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#FF6B14" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={theme.accent}
          />
        }>
        <View className="items-center px-5 py-8">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-100 shadow-sm">
            <ThemedText className="text-3xl font-black text-gray-400">
              {merchantInitials(merchant)}
            </ThemedText>
          </View>
          <ThemedText className="mt-6 text-3xl font-black text-center">
            {merchant} - {formatMoney(total)}
          </ThemedText>
          <View className="mt-5 flex-row items-center rounded-full bg-orange-50 px-5 py-3">
            <MaterialCommunityIcons name="receipt-text-outline" size={18} color="#FF6B14" />
            <ThemedText className="ml-2 text-base font-black" style={{ color: '#FF6B14' }}>
              {filtered.length} transactions
            </ThemedText>
          </View>
        </View>

        <View className="mx-5 mb-7 flex-row items-center rounded-[24px] bg-white px-5 py-4 shadow-sm dark:bg-gray-800">
          <MaterialCommunityIcons name="magnify" size={25} color="#817B77" />
          <TextInput
            className="ml-3 flex-1 text-base font-semibold text-gray-900"
            placeholder="Search within history..."
            placeholderTextColor="#817B77"
            value={query}
            onChangeText={setQuery}
          />
          {loading && <ActivityIndicator color={theme.accent} />}
        </View>

        {error && (
          <View className="mx-5 mb-5 rounded-2xl border border-red-100 bg-red-50 p-3">
            <ThemedText className="text-center text-sm text-red-600">{error}</ThemedText>
          </View>
        )}

        {sections.length === 0 ? (
          <StateView
            icon="store-search-outline"
            title="No merchant transactions"
            message="Try a wider period or a different search within this merchant history."
            compact
          />
        ) : (
          sections.map((section) => (
            <View key={section.title} className="mb-7 px-5">
              <ThemedText className="mb-4 text-[13px] font-black uppercase tracking-[3px] text-gray-500">
                {section.title}
              </ThemedText>
              <View className="overflow-hidden rounded-[26px] border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                {section.data.map((transaction, index) => (
                  <MerchantTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    isLast={index === section.data.length - 1}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-8 left-5 right-5 flex-row gap-4">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center rounded-[24px] py-5 shadow-lg"
          style={{ backgroundColor: theme.accent }}>
          <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={22} color="white" />
          <ThemedText className="ml-3 text-lg font-black text-white">Merchant Insights</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity className="h-[64px] w-[64px] items-center justify-center rounded-[24px] bg-white shadow-sm">
          <MaterialCommunityIcons name="download-outline" size={26} color={theme.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function MerchantTransactionRow({
  transaction,
  isLast,
}: {
  transaction: Transaction;
  isLast: boolean;
}) {
  const amount = Math.abs(transaction.amount);
  const isIncome = transaction.entryType === 'income';
  return (
    <TouchableOpacity
      className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
      onPress={() =>
        router.push({
          pathname: '/entry/[id]',
          params: {
            id: transaction.id,
            name: transaction.name,
            category: transaction.category,
            amount: String(amount),
            entryType: transaction.entryType ?? 'expense',
            section: transaction.section,
            mode: transaction.mode ?? '',
            notes: transaction.notes ?? '',
            merchant: transaction.merchant ?? '',
            dateLabel: transaction.dateLabel ?? '',
            rawDate: transaction.rawDate ?? '',
            tag: transaction.tag ?? '',
          },
        })
      }>
      <View
        className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: transaction.bgColor }}>
        <MaterialCommunityIcons
          name={transaction.icon as any}
          size={23}
          color={transaction.color}
        />
      </View>
      <View className="flex-1 pr-3">
        <ThemedText className="text-base font-black">{transaction.name}</ThemedText>
        <View className="mt-1 flex-row items-center">
          <ThemedText
            className="mr-2 rounded-md px-2 py-1 text-[11px] font-black"
            style={{ color: transaction.color, backgroundColor: transaction.bgColor }}>
            {transaction.category}
          </ThemedText>
          <ThemedText className="text-xs text-gray-500">
            {transaction.accountName ?? transaction.mode ?? 'Account not set'}
          </ThemedText>
        </View>
      </View>
      <View className="items-end">
        <ThemedText className="text-base font-black">
          {isIncome ? '+' : ''}
          {formatMoney(amount)}
        </ThemedText>
        <ThemedText className="mt-1 text-xs text-gray-500">
          {transaction.dateLabel?.split(' ').slice(0, 2).join(' ') ?? ''}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

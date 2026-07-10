import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateRange, PeriodPicker } from '@/components/insights/PeriodPicker';
import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DashboardResponse, InsightCard, fetchDashboard } from '@/lib/insights';
import { subscribeTransactionsChanged } from '@/lib/transaction-events';
import { formatApiDate } from '@/lib/transactions';

const formatMoney = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function InsightScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
    label: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    preset: 'this_month',
  });

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const start = currentRange.start ? formatApiDate(currentRange.start) : undefined;
        const end = currentRange.end ? formatApiDate(currentRange.end) : undefined;
        setDashboard(await fetchDashboard(token, start, end));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentRange.end, currentRange.start, token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData])
  );

  useEffect(
    () =>
      subscribeTransactionsChanged(() => {
        void loadData(true);
      }),
    [loadData]
  );

  if (loading && !dashboard) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon="chart-box-outline"
          title="Loading dashboard"
          message="Preparing your spending summary."
          loading
        />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon={error ? 'wifi-off' : 'chart-box-outline'}
          title={error ? 'Dashboard did not load' : 'No dashboard data yet'}
          message={error || 'Capture a transaction to start seeing insights.'}
          actionLabel="Try again"
          onAction={() => void loadData()}
        />
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
      edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View>
          <ThemedText className="text-xl font-black">Dashboard</ThemedText>
          <TouchableOpacity
            className="mt-1 flex-row items-center"
            onPress={() => setPickerVisible(true)}>
            <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>
              {currentRange.label}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={14} color={theme.accent} />
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={theme.accent} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 22, gap: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadData(true);
            }}
            tintColor={theme.accent}
          />
        }>
        {error && (
          <View className="rounded-2xl border border-red-100 bg-red-50 p-3">
            <ThemedText className="text-center text-sm text-red-600">{error}</ThemedText>
            <TouchableOpacity className="mt-2 items-center" onPress={() => void loadData()}>
              <ThemedText className="text-sm font-bold" style={{ color: theme.accent }}>
                Retry
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {dashboard.summary.transaction_count === 0 && (
          <StateView
            icon="chart-box-outline"
            title="No dashboard data for this period"
            message="Choose a wider period or add a transaction to populate these charts."
            actionLabel="Change period"
            onAction={() => setPickerVisible(true)}
            compact
          />
        )}

        <SummarySection dashboard={dashboard} />
        <CategorySection categories={dashboard.top_categories} />
        <AccountSection accounts={dashboard.account_spending} accent={theme.accent} />
        <MerchantSection merchants={dashboard.top_merchants} />
        <RecentSection entries={dashboard.recent_transactions} />
        <InsightSection cards={dashboard.insights} />
      </ScrollView>

      <PeriodPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={setCurrentRange}
        currentRange={currentRange}
      />
    </SafeAreaView>
  );
}

function SummarySection({ dashboard }: { dashboard: DashboardResponse }) {
  const summary = dashboard.summary;
  return (
    <View className="rounded-[24px] border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        Selected period
      </ThemedText>
      <ThemedText className="mt-2 text-2xl font-black">
        {formatMoney(summary.total_spent)}
      </ThemedText>
      <ThemedText className="text-xs text-gray-500">Total spent</ThemedText>
      <View className="mt-5 flex-row gap-3">
        <Metric label="Daily average" value={formatMoney(summary.daily_average)} />
        <Metric label="Income recorded" value={formatMoney(summary.total_income)} />
        <Metric label="Transactions" value={String(summary.transaction_count)} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-gray-50 p-3 dark:bg-gray-700">
      <ThemedText className="text-[9px] font-bold uppercase text-gray-400">{label}</ThemedText>
      <ThemedText className="mt-1 text-sm font-black">{value}</ThemedText>
    </View>
  );
}

function CategorySection({ categories }: { categories: DashboardResponse['top_categories'] }) {
  return (
    <Section title="Top categories" empty={categories.length === 0}>
      {categories.map((category) => (
        <View key={category.category} className="mb-4">
          <View className="mb-2 flex-row justify-between">
            <ThemedText className="text-sm font-bold">{category.category}</ThemedText>
            <ThemedText className="text-sm font-black">{formatMoney(category.amount)}</ThemedText>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <View
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${Math.min(category.percentage, 100)}%` }}
            />
          </View>
        </View>
      ))}
    </Section>
  );
}

function AccountSection({
  accounts,
  accent,
}: {
  accounts: DashboardResponse['account_spending'];
  accent: string;
}) {
  return (
    <Section title="Account-wise spending" empty={accounts.length === 0}>
      {accounts.map((account) => (
        <View key={account.account_id ?? 'unassigned'} className="mb-4">
          <View className="mb-2 flex-row justify-between">
            <ThemedText className="text-sm font-bold">{account.account_name}</ThemedText>
            <ThemedText className="text-sm font-black">{formatMoney(account.amount)}</ThemedText>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <View
              className="h-full rounded-full"
              style={{ backgroundColor: accent, width: `${Math.min(account.percentage, 100)}%` }}
            />
          </View>
        </View>
      ))}
    </Section>
  );
}

function MerchantSection({ merchants }: { merchants: DashboardResponse['top_merchants'] }) {
  return (
    <Section title="Top merchants" empty={merchants.length === 0}>
      {merchants.map((merchant) => (
        <View key={merchant.merchant} className="mb-3 flex-row items-center justify-between">
          <View>
            <ThemedText className="text-sm font-bold">{merchant.merchant}</ThemedText>
            <ThemedText className="text-xs text-gray-400">
              {merchant.transaction_count} transaction(s)
            </ThemedText>
          </View>
          <ThemedText className="text-sm font-black">{formatMoney(merchant.amount)}</ThemedText>
        </View>
      ))}
    </Section>
  );
}

function RecentSection({ entries }: { entries: DashboardResponse['recent_transactions'] }) {
  return (
    <Section title="Recent transactions" empty={entries.length === 0}>
      {entries.map((entry) => (
        <View key={entry.id} className="mb-3 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <ThemedText className="text-sm font-bold">
              {entry.title || entry.merchant || entry.category || 'Transaction'}
            </ThemedText>
            <ThemedText className="text-xs text-gray-400">{entry.date}</ThemedText>
          </View>
          <ThemedText className="text-sm font-black">
            {formatMoney(Number(entry.amount || 0))}
          </ThemedText>
        </View>
      ))}
    </Section>
  );
}

function InsightSection({ cards }: { cards: InsightCard[] }) {
  return (
    <Section title="Insights" empty={cards.length === 0}>
      {cards.map((card) => (
        <View
          key={card.kind}
          className={`mb-3 rounded-2xl border-l-4 p-4 ${
            card.severity === 'warning'
              ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          }`}>
          <ThemedText className="text-sm font-black">{card.title}</ThemedText>
          <ThemedText className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
            {card.body}
          </ThemedText>
        </View>
      ))}
    </Section>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[24px] border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <ThemedText className="mb-4 text-base font-black">{title}</ThemedText>
      {empty ? (
        <ThemedText className="text-sm text-gray-400">No data for this period.</ThemedText>
      ) : (
        children
      )}
    </View>
  );
}

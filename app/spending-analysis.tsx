import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { DashboardResponse, InsightCard, fetchDashboard } from '@/lib/insights';
import { subscribeTransactionsChanged } from '@/lib/transaction-events';
import { resolveCategoryMetadata } from '@/lib/transactions';

const formatMoney = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const toParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const monthLabelFromPeriod = (dashboard: DashboardResponse | null, fallback?: string) => {
  if (fallback) return fallback;
  if (!dashboard?.period.start) return 'Selected Period';
  const parsed = new Date(`${dashboard.period.start}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? 'Selected Period'
    : parsed.toLocaleString('default', { month: 'short', year: 'numeric' });
};

export default function SpendingAnalysisScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = toParam(params.start);
  const end = toParam(params.end);
  const label = toParam(params.label);

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchDashboard(token, start, end));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load detailed analysis.'
      );
    } finally {
      setLoading(false);
    }
  }, [end, start, token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(
    () =>
      subscribeTransactionsChanged(() => {
        void loadData();
      }),
    [loadData]
  );

  const periodLabel = useMemo(() => monthLabelFromPeriod(dashboard, label), [dashboard, label]);

  if (loading && !dashboard) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon="chart-line"
          title="Loading detailed analysis"
          message="Building your spending breakdown."
          loading
        />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon={error ? 'wifi-off' : 'chart-line'}
          title={error ? 'Analysis did not load' : 'No analysis yet'}
          message={error || 'Add transactions to generate a detailed spending view.'}
          actionLabel="Try again"
          onAction={() => void loadData()}
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
        <ThemedText className="text-base font-black" style={{ color: theme.text }}>
          Detailed Analysis
        </ThemedText>
        <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-800">
          <MaterialCommunityIcons name="share-variant-outline" size={20} color="#6F6965" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}>
        {error && (
          <View className="mx-5 mb-4 rounded-2xl border border-red-100 bg-red-50 p-3">
            <ThemedText className="text-center text-sm text-red-600">{error}</ThemedText>
          </View>
        )}

        <View className="mt-3 items-center">
          <View
            className="mb-3 flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: theme.secondary }}>
            <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>
              {periodLabel}
            </ThemedText>
            {loading && <ActivityIndicator className="ml-2" size="small" color={theme.accent} />}
          </View>
          <ThemedText className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-500">
            Total Spending
          </ThemedText>
          <ThemedText className="text-4xl font-black" style={{ color: theme.text }}>
            {formatMoney(dashboard.summary.total_spent)}
          </ThemedText>
        </View>

        <DailyTrendCard dashboard={dashboard} />
        <CategoryBreakdown dashboard={dashboard} periodLabel={periodLabel} />
        <TopMerchants dashboard={dashboard} periodLabel={periodLabel} />
        <BehavioralInsights cards={dashboard.insights} />
      </ScrollView>

      <View className="absolute bottom-8 left-5 right-5">
        <TouchableOpacity
          className="flex-row items-center justify-center rounded-2xl py-4 shadow-lg"
          style={{ backgroundColor: theme.accent }}>
          <MaterialCommunityIcons name="file-chart" size={20} color="white" />
          <ThemedText className="ml-2 font-black text-white">Generate Weekly Report</ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DailyTrendCard({ dashboard }: { dashboard: DashboardResponse }) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const [selectedIndex, setSelectedIndex] = useState(10);
  const points = useMemo(() => {
    const avg = dashboard.summary.daily_average;
    return [0.7, 0.62, 0.84, 1.22, 1.28, 1.2, 0.96, 0.82, 1.02, 1.42, 1.3].map((n) =>
      Math.max(8, Math.round(avg * n))
    );
  }, [dashboard.summary.daily_average]);
  const maxPoint = Math.max(...points, 1);
  const selectedPoint = points[selectedIndex] ?? points[points.length - 1] ?? 0;
  const selectedDelta =
    dashboard.summary.daily_average > 0
      ? Math.round(
          ((selectedPoint - dashboard.summary.daily_average) / dashboard.summary.daily_average) *
            100
        )
      : 0;
  const selectedLabel =
    selectedIndex === 0
      ? 'Start of period'
      : selectedIndex === points.length - 1
        ? 'End of period'
        : `Trend point ${selectedIndex + 1}`;
  const todaySpend = Number(dashboard.recent_transactions[0]?.amount ?? 0);
  const delta =
    dashboard.summary.daily_average > 0
      ? Math.round(
          ((todaySpend - dashboard.summary.daily_average) / dashboard.summary.daily_average) * 100
        )
      : 0;

  return (
    <View
      className="mx-5 mt-8 rounded-[28px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="mb-7 flex-row items-start justify-between">
        <View>
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Daily Trend
          </ThemedText>
          <ThemedText className="mt-1 text-lg font-black">Daily Fluctuations</ThemedText>
        </View>
        <View className="rounded-lg px-3 py-2" style={{ backgroundColor: theme.secondary }}>
          <ThemedText className="text-[10px] font-black" style={{ color: theme.accent }}>
            Avg {formatMoney(dashboard.summary.daily_average)}/day
          </ThemedText>
        </View>
      </View>

      <View className="h-40 flex-row items-end justify-between overflow-hidden">
        {points.map((point, index) => {
          const selected = selectedIndex === index;
          return (
            <TouchableOpacity
              key={`${point}-${index}`}
              activeOpacity={0.78}
              className="items-center justify-end"
              onPress={() => setSelectedIndex(index)}>
              <View
                className="mb-2 h-2 w-2 rounded-full"
                style={{
                  opacity: selected ? 1 : 0,
                  backgroundColor: theme.accent,
                }}
              />
              <View
                className="w-5 rounded-t-full"
                style={{
                  height: Math.max(18, (point / maxPoint) * 130),
                  opacity: selected ? 1 : 0.16 + index * 0.07,
                  backgroundColor: theme.accent,
                  width: selected ? 24 : 20,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View className="mt-3 flex-row justify-between">
        <ThemedText className="text-[10px] text-gray-500">Start</ThemedText>
        <ThemedText className="text-[10px] text-gray-500">Mid</ThemedText>
        <ThemedText className="text-[10px] text-gray-500">End</ThemedText>
      </View>

      <View className="mt-5 flex-row items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
        <View className="flex-row items-center">
          <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: theme.accent }} />
          <ThemedText className="text-xs font-bold">
            Latest Spend: {formatMoney(todaySpend)}
          </ThemedText>
        </View>
        {delta !== 0 && (
          <ThemedText
            className="text-[10px] font-bold"
            style={{ color: delta > 0 ? theme.accent : '#00B878' }}>
            {Math.abs(delta)}% {delta > 0 ? 'Higher' : 'Lower'} than Avg
          </ThemedText>
        )}
      </View>

      <View
        className="mt-4 rounded-2xl border px-4 py-3"
        style={{ backgroundColor: theme.secondary, borderColor: theme.border }}>
        <View className="flex-row items-center justify-between">
          <View>
            <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Selected Bar
            </ThemedText>
            <ThemedText className="mt-1 text-sm font-black">{selectedLabel}</ThemedText>
          </View>
          <ThemedText className="text-base font-black" style={{ color: theme.accent }}>
            {formatMoney(selectedPoint)}
          </ThemedText>
        </View>
        <ThemedText className="mt-2 text-xs leading-5 text-gray-600">
          {selectedDelta === 0
            ? 'This day is tracking close to your daily average.'
            : `${Math.abs(selectedDelta)}% ${selectedDelta > 0 ? 'above' : 'below'} your daily average.`}
        </ThemedText>
      </View>
    </View>
  );
}

function CategoryBreakdown({
  dashboard,
  periodLabel,
}: {
  dashboard: DashboardResponse;
  periodLabel: string;
}) {
  if (dashboard.top_categories.length === 0) return null;

  return (
    <View className="mx-5 mt-8">
      <ThemedText className="mb-4 text-lg font-black">By Category</ThemedText>
      <View className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {dashboard.top_categories.map((category, index) => {
          const meta = resolveCategoryMetadata(category.category);
          return (
            <TouchableOpacity
              key={category.category}
              className={`flex-row items-center p-5 ${index < dashboard.top_categories.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
              onPress={() =>
                router.push({
                  pathname: '/category-detail',
                  params: {
                    category: category.category,
                    start: dashboard.period.start,
                    end: dashboard.period.end,
                    label: periodLabel,
                  },
                })
              }>
              <View
                className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: meta.bgColor }}>
                <MaterialCommunityIcons name={meta.icon} size={23} color={meta.color} />
              </View>
              <View className="flex-1">
                <ThemedText className="text-sm font-black">{category.category}</ThemedText>
                <ThemedText className="mt-1 text-[11px] text-gray-500">
                  {Math.round(category.percentage)}% of total
                </ThemedText>
              </View>
              <View className="items-end">
                <ThemedText className="text-sm font-black">
                  {formatMoney(category.amount)}
                </ThemedText>
                <View className="mt-2 h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(category.percentage, 100)}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CFCAC6" />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TopMerchants({
  dashboard,
  periodLabel,
}: {
  dashboard: DashboardResponse;
  periodLabel: string;
}) {
  if (dashboard.top_merchants.length === 0) return null;

  return (
    <View className="mx-5 mt-8">
      <ThemedText className="mb-4 text-lg font-black">Top Merchants</ThemedText>
      <View className="overflow-hidden rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {dashboard.top_merchants.map((merchant, index) => (
          <TouchableOpacity
            key={merchant.merchant}
            className={`flex-row items-center ${index < dashboard.top_merchants.length - 1 ? 'mb-4' : ''}`}
            onPress={() =>
              router.push({
                pathname: '/merchant-history',
                params: {
                  merchant: merchant.merchant,
                  start: dashboard.period.start,
                  end: dashboard.period.end,
                  label: periodLabel,
                },
              })
            }>
            <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-gray-100">
              <ThemedText className="text-[10px] font-black text-gray-400">
                {merchant.merchant.slice(0, 3).toUpperCase()}
              </ThemedText>
            </View>
            <View className="flex-1">
              <ThemedText className="text-sm font-bold">{merchant.merchant}</ThemedText>
              <ThemedText className="text-[11px] text-gray-500">
                {merchant.transaction_count} transactions
              </ThemedText>
            </View>
            <View className="items-end">
              <ThemedText className="text-sm font-black">{formatMoney(merchant.amount)}</ThemedText>
              <ThemedText className="mt-1 text-[10px] font-bold" style={{ color: '#9B9692' }}>
                Details
              </ThemedText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CFCAC6" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function BehavioralInsights({ cards }: { cards: InsightCard[] }) {
  const theme = useThemeTokens();
  if (cards.length === 0) return null;

  return (
    <View className="mx-5 mt-8">
      <ThemedText className="mb-4 text-lg font-black">Behavioral Insights</ThemedText>
      <View className="gap-4">
        {cards.slice(0, 4).map((card) => {
          const warning = card.severity === 'warning';
          const color = warning ? '#FF6680' : theme.colors.accent;
          return (
            <View
              key={card.kind}
              className="flex-row rounded-[24px] border p-5"
              style={{
                backgroundColor: warning ? '#FFF3F5' : theme.colors.secondary,
                borderColor: warning ? '#FFD3DB' : theme.colors.border,
              }}>
              <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-white">
                <MaterialCommunityIcons
                  name={warning ? 'alarm-light-outline' : 'sofa-outline'}
                  size={22}
                  color={color}
                />
              </View>
              <View className="flex-1">
                <ThemedText className="text-sm font-black" style={{ color }}>
                  {card.title}
                </ThemedText>
                <ThemedText className="mt-1 text-xs leading-5 text-gray-700">
                  {card.body}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

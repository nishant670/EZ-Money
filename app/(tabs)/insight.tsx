import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { DashboardResponse, InsightCard, fetchDashboard } from '@/lib/insights';
import { subscribeTransactionsChanged } from '@/lib/transaction-events';
import { formatApiDate, resolveCategoryMetadata } from '@/lib/transactions';

const formatMoney = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const defaultRange = (): DateRange => {
  const current = new Date();
  return {
    start: new Date(current.getFullYear(), current.getMonth(), 1),
    end: current,
    label: current.toLocaleString('default', { month: 'long', year: 'numeric' }),
    preset: 'this_month',
  };
};

const getInsightLevel = (dashboard: DashboardResponse) => {
  const count = dashboard.summary.transaction_count;
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (dashboard.top_categories.length < 2 || dashboard.top_merchants.length < 1) return 2;
  if (dashboard.account_spending.length < 1 || dashboard.insights.length < 2) return 3;
  return 4;
};

const getBurnRateCopy = (dashboard: DashboardResponse) => {
  const { total_income: income, total_spent: spent, daily_average: daily } = dashboard.summary;
  if (daily <= 0) return 'Add more transactions to estimate your spending rhythm.';
  if (income > spent) {
    const remaining = income - spent;
    const days = Math.max(1, Math.round(remaining / daily));
    return `At your current spending pace, your surplus can cover ~${days} more days.`;
  }
  return 'Spending has caught up with recorded income for this period.';
};

const getPeriodPulse = (dashboard: DashboardResponse, reviewCount: number) => {
  const { total_income: income, total_spent: spent, transaction_count: count } = dashboard.summary;
  if (count === 0) {
    return {
      label: 'Waiting for data',
      reason: 'Add confirmed transactions to build this period summary.',
      color: '#9B9692',
      icon: 'progress-clock',
    };
  }
  if (reviewCount > 0) {
    return {
      label: 'Needs review',
      reason: `${reviewCount} transaction${reviewCount === 1 ? '' : 's'} need category or account cleanup.`,
      color: '#FFB020',
      icon: 'playlist-check',
    };
  }
  if (income <= 0 && spent > 0) {
    return {
      label: 'No income recorded',
      reason: 'This period has expenses but no recorded income, so surplus cannot be estimated.',
      color: '#FFB020',
      icon: 'cash-remove',
    };
  }
  if (income > 0 && spent > income) {
    return {
      label: 'Watch spending',
      reason: 'Confirmed expenses are higher than recorded income for this period.',
      color: '#FF6680',
      icon: 'alert-circle-outline',
    };
  }
  return {
    label: 'On track',
    reason: 'Recorded income is higher than confirmed expenses for this period.',
    color: '#00B878',
    icon: 'check-decagram',
  };
};

const needsTransactionReview = (entry: DashboardResponse['recent_transactions'][number]) => {
  const category = String(entry.category ?? '')
    .trim()
    .toLowerCase();
  return !category || category === 'uncategorized' || !entry.account_id;
};

const getNeedsReview = (dashboard: DashboardResponse) => {
  const apiItems = dashboard.review_items ?? [];
  if (apiItems.length > 0) return apiItems;
  return dashboard.recent_transactions.filter(needsTransactionReview);
};

const getReviewReasons = (entry: DashboardResponse['recent_transactions'][number]) => {
  const reasons: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [];
  const category = String(entry.category ?? '').trim();
  if (!category) {
    reasons.push({ label: 'Missing category', icon: 'shape-outline' });
  } else if (category.toLowerCase() === 'uncategorized') {
    reasons.push({ label: 'Uncategorized', icon: 'shape-plus-outline' });
  }
  if (!entry.account_id) {
    reasons.push({ label: 'Missing account', icon: 'credit-card-outline' });
  }
  return reasons.length > 0 ? reasons : [{ label: 'Needs review', icon: 'playlist-check' }];
};

const openDashboardEntryForReview = (entry: DashboardResponse['recent_transactions'][number]) => {
  if (entry.id == null) return;
  const reasons = getReviewReasons(entry);
  const reviewFields = reasons
    .map((reason) => {
      if (reason.label === 'Missing account') return 'account';
      if (reason.label === 'Missing category' || reason.label === 'Uncategorized') return 'category';
      return '';
    })
    .filter(Boolean);
  const reviewFocus = reviewFields.includes('category') ? 'category' : reviewFields[0];
  router.push({
    pathname: '/entry/[id]',
    params: {
      id: String(entry.id),
      name: entry.title || entry.merchant || entry.category || 'Transaction',
      category: entry.category ?? '',
      amount: String(Math.abs(Number(entry.amount || 0))),
      entryType: String(entry.type ?? 'expense').toLowerCase() === 'income' ? 'income' : 'expense',
      section: 'Needs review',
      mode: entry.mode ?? '',
      notes: entry.notes ?? '',
      merchant: entry.merchant ?? '',
      dateLabel: entry.date ?? '',
      rawDate: entry.date ?? '',
      tag: entry.tag ?? '',
      edit: '1',
      reviewFocus: reviewFocus ?? '',
      reviewFields: reviewFields.join(','),
      categorySuggestions: JSON.stringify(entry.category_suggestions ?? []),
    },
  });
};

const getTopTakeaway = (dashboard: DashboardResponse, reviewCount: number) => {
  const warning = dashboard.insights.find((item) => item.severity === 'warning');
  const topCategory = dashboard.top_categories[0];

  if (reviewCount > 0) {
    return {
      eyebrow: 'Fix first',
      title: `${reviewCount} transaction${reviewCount === 1 ? '' : 's'} need review`,
      body: 'Resolve missing categories or accounts so the rest of your insights stay accurate.',
      icon: 'playlist-check',
      tone: 'warning' as const,
    };
  }

  if (warning) {
    return {
      eyebrow: 'Worth attention',
      title: warning.title,
      body: warning.body,
      icon: 'alarm-light-outline',
      tone: 'warning' as const,
    };
  }

  if (topCategory) {
    return {
      eyebrow: 'Main driver',
      title: `${topCategory.category} is ${Math.round(topCategory.percentage)}% of spend`,
      body: `${formatMoney(topCategory.amount)} recorded in this category during the selected period.`,
      icon: resolveCategoryMetadata(topCategory.category).icon,
      tone: 'info' as const,
    };
  }

  return {
    eyebrow: 'Spending pace',
    title: `${formatMoney(dashboard.summary.daily_average)} per day`,
    body: 'This is your average confirmed expense pace for the selected period.',
    icon: 'speedometer',
    tone: 'info' as const,
  };
};

export default function InsightScreen() {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange>(defaultRange);

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
        setError(loadError instanceof Error ? loadError.message : 'Unable to load insights.');
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

  const insightLevel = useMemo(() => (dashboard ? getInsightLevel(dashboard) : 0), [dashboard]);
  const reviewItems = useMemo(() => (dashboard ? getNeedsReview(dashboard) : []), [dashboard]);
  const previewReviewItems = useMemo(() => reviewItems.slice(0, 3), [reviewItems]);
  const allClear = useMemo(
    () =>
      Boolean(
        dashboard &&
          dashboard.summary.transaction_count > 0 &&
          reviewItems.length === 0 &&
          !dashboard.budget_statuses?.some((budget) => budget.status !== 'safe') &&
          dashboard.recurring_candidates.length === 0 &&
          !dashboard.insights.some((insight) => insight.severity === 'warning')
      ),
    [dashboard, reviewItems.length]
  );

  if (loading && !dashboard) {
    return (
      <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
        <StateView
          icon="chart-box-outline"
          title="Loading insights"
          message="Preparing your financial health view."
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
          title={error ? 'Insights did not load' : 'No insights yet'}
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
      <View className="flex-row items-center justify-between px-5 py-4">
        <View>
          <ThemedText className="text-2xl font-black">Insights</ThemedText>
          <TouchableOpacity
            className="mt-1 flex-row items-center"
            onPress={() => setPickerVisible(true)}>
            <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>
              {currentRange.label}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={14} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-3">
          {loading && <ActivityIndicator color={theme.accent} />}
          <HeaderIcon name="magnify" onPress={() => router.push('/transactions')} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 110,
          gap: 20,
        }}
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
            title="No insights for this period"
            message="Choose a wider period or add transactions to populate this screen."
            actionLabel="Change period"
            onAction={() => setPickerVisible(true)}
            compact
          />
        )}

        <TopTakeawayCard dashboard={dashboard} reviewCount={reviewItems.length} />

        <PeriodPulseCard dashboard={dashboard} insightLevel={insightLevel} reviewCount={reviewItems.length} />

        <WeeklyReviewTeaser dashboard={dashboard} rangeLabel={currentRange.label} />

        {allClear && <AllClearCard dashboard={dashboard} />}

        {insightLevel >= 1 && <ProgressiveHint insightLevel={insightLevel} dashboard={dashboard} />}

        {insightLevel >= 2 && (
          <SpendingAnalysisCard
            dashboard={dashboard}
            onDetails={() =>
              router.push({
                pathname: '/spending-analysis',
                params: {
                  start: dashboard.period.start,
                  end: dashboard.period.end,
                  label: currentRange.label,
                },
              })
            }
          />
        )}

        {insightLevel >= 2 && (
          <SmartAlerts cards={dashboard.insights} dashboard={dashboard} rangeLabel={currentRange.label} />
        )}

        {dashboard.budget_statuses?.some((budget) => budget.status !== 'safe') && (
          <BudgetWatchSection dashboard={dashboard} rangeLabel={currentRange.label} />
        )}

        {dashboard.recurring_candidates.length > 0 && (
          <RecurringReviewTeaser dashboard={dashboard} rangeLabel={currentRange.label} />
        )}

        {insightLevel >= 3 && <AccountIntelligence dashboard={dashboard} />}

        {previewReviewItems.length > 0 && (
          <NeedsReview
            entries={previewReviewItems}
            totalCount={reviewItems.length}
            periodStart={dashboard.period.start}
            periodEnd={dashboard.period.end}
          />
        )}

        {insightLevel < 4 && dashboard.summary.transaction_count > 0 && (
          <UnlockCard dashboard={dashboard} insightLevel={insightLevel} />
        )}
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

function HeaderIcon({
  name,
  onPress,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
}) {
  const theme = useThemeTokens();

  return (
    <TouchableOpacity
      className="h-10 w-10 items-center justify-center rounded-full shadow-sm"
      style={{ backgroundColor: theme.colors.card }}
      onPress={onPress}>
      <MaterialCommunityIcons name={name} size={20} color={theme.colors.text} />
    </TouchableOpacity>
  );
}

function TopTakeawayCard({
  dashboard,
  reviewCount,
}: {
  dashboard: DashboardResponse;
  reviewCount: number;
}) {
  const theme = useThemeTokens();
  const takeaway = getTopTakeaway(dashboard, reviewCount);
  const color = takeaway.tone === 'warning' ? '#FF6680' : theme.colors.accent;
  const topCategory = dashboard.top_categories[0];

  const handleAction = () => {
    if (reviewCount > 0) {
      router.push({
        pathname: '/transactions',
        params: {
          review: '1',
          start_date: dashboard.period.start,
          end_date: dashboard.period.end,
        },
      });
      return;
    }
    if (takeaway.tone === 'warning') {
      const warning = dashboard.insights.find((item) => item.severity === 'warning');
      if (warning) {
        router.push({
          pathname: '/insight-detail',
          params: insightDetailParams(warning, dashboard, dashboard.period.start),
        });
        return;
      }
    }
    if (topCategory) {
      router.push({
        pathname: '/category-detail',
        params: {
          category: topCategory.category,
          start: dashboard.period.start,
          end: dashboard.period.end,
          label: dashboard.period.start,
        },
      });
      return;
    }
    router.push('/spending-analysis');
  };

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${color}1A` }}>
          <MaterialCommunityIcons
            name={takeaway.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={23}
            color={color}
          />
        </View>
        <View className="flex-1">
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {takeaway.eyebrow}
          </ThemedText>
          <ThemedText className="mt-1 text-xl font-black">{takeaway.title}</ThemedText>
          <ThemedText className="mt-2 text-xs leading-5 text-gray-500">{takeaway.body}</ThemedText>
        </View>
      </View>
      <TouchableOpacity
        onPress={handleAction}
        className="mt-4 h-11 flex-row items-center justify-center rounded-2xl"
        style={{ backgroundColor: theme.colors.secondary }}>
        <ThemedText className="text-xs font-black" style={{ color }}>
          Open next step
        </ThemedText>
        <MaterialCommunityIcons name="chevron-right" size={18} color={color} />
      </TouchableOpacity>
    </View>
  );
}

function PeriodPulseCard({
  dashboard,
  insightLevel,
  reviewCount,
}: {
  dashboard: DashboardResponse;
  insightLevel: number;
  reviewCount: number;
}) {
  const theme = useThemeTokens();
  const accentSurface = theme.mode === 'dark' ? theme.colors.secondary : theme.colors.secondary;
  const pulse = getPeriodPulse(dashboard, reviewCount);
  const surplus = dashboard.summary.total_income - dashboard.summary.total_spent;

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Period Pulse
          </ThemedText>
          <ThemedText className="mt-1 text-2xl font-black">{pulse.label}</ThemedText>
          <ThemedText className="mt-2 text-xs leading-5 text-gray-500">{pulse.reason}</ThemedText>
        </View>
        <View
          className="h-[58px] w-[58px] items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${pulse.color}1A` }}>
          <MaterialCommunityIcons
            name={pulse.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={25}
            color={pulse.color}
          />
        </View>
      </View>

      <View className="mt-7 gap-3">
        <View className="flex-row gap-3">
          <PulseMetric label="Income" value={formatMoney(dashboard.summary.total_income)} />
          <PulseMetric label="Spent" value={formatMoney(dashboard.summary.total_spent)} />
        </View>
        <View className="flex-row gap-3">
          <PulseMetric
            label={surplus >= 0 ? 'Surplus' : 'Over income'}
            value={formatMoney(Math.abs(surplus))}
          />
          <PulseMetric label="Daily avg" value={formatMoney(dashboard.summary.daily_average)} />
        </View>
      </View>

      <View
        className="mt-5 rounded-2xl border p-3"
        style={{ backgroundColor: accentSurface, borderColor: theme.colors.border }}>
        <View className="flex-row items-start">
          <View
            className="mr-3 h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.card }}>
            <MaterialCommunityIcons name="timer-sand" size={16} color={theme.colors.accent} />
          </View>
          <View className="flex-1">
            <ThemedText className="text-xs leading-5">
              <ThemedText className="text-xs font-black" style={{ color: theme.colors.accent }}>
                Why this status:{' '}
              </ThemedText>
              {getBurnRateCopy(dashboard)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row items-start gap-3">
        <ThemedText className="flex-1 text-[11px] font-bold text-gray-500">
          Insight depth grows as Finnri sees more transactions, merchants, and accounts.
        </ThemedText>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: accentSurface, flexShrink: 0 }}>
          <ThemedText className="text-[10px] font-black" style={{ color: theme.colors.accent }}>
            L{insightLevel}/4
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function WeeklyReviewTeaser({
  dashboard,
  rangeLabel,
}: {
  dashboard: DashboardResponse;
  rangeLabel: string;
}) {
  const theme = useThemeTokens();
  const budgetRisks = dashboard.budget_statuses?.filter((budget) => budget.status !== 'safe').length ?? 0;
  const recurringCount = dashboard.recurring_candidates.length;
  const warningCount = dashboard.insights.filter((insight) => insight.severity === 'warning').length;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() =>
        router.push({
          pathname: '/weekly-review',
          params: {
            start: dashboard.period.start,
            end: dashboard.period.end,
            label: rangeLabel,
          },
        })
      }
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: theme.colors.secondary }}>
          <MaterialCommunityIcons name="file-chart-outline" size={23} color={theme.colors.accent} />
        </View>
        <View className="flex-1">
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Weekly Review
          </ThemedText>
          <ThemedText className="mt-1 text-base font-black">Review the money story</ThemedText>
          <ThemedText className="mt-1 text-xs leading-5 text-gray-500">
            {budgetRisks} budget risk{budgetRisks === 1 ? '' : 's'} · {recurringCount} recurring · {warningCount} alert{warningCount === 1 ? '' : 's'}
          </ThemedText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

function AllClearCard({ dashboard }: { dashboard: DashboardResponse }) {
  const theme = useThemeTokens();
  const topCategory = dashboard.top_categories[0];
  const surplus = dashboard.summary.total_income - dashboard.summary.total_spent;

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#DCFCE7' }}>
          <MaterialCommunityIcons name="check-decagram" size={24} color="#16A34A" />
        </View>
        <View className="flex-1">
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            All clear
          </ThemedText>
          <ThemedText className="mt-1 text-lg font-black">No urgent actions right now</ThemedText>
          <ThemedText className="mt-1 text-xs leading-5 text-gray-500">
            Categories and accounts look clean, budgets are safe, and there are no warning alerts for this period.
          </ThemedText>
        </View>
      </View>
      <View className="mt-4 flex-row gap-3">
        <PulseMetric
          label={surplus >= 0 ? 'Surplus' : 'Over income'}
          value={formatMoney(Math.abs(surplus))}
        />
        <PulseMetric
          label="Top spend"
          value={topCategory ? topCategory.category : formatMoney(dashboard.summary.daily_average)}
        />
      </View>
    </View>
  );
}

function PulseMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const theme = useThemeTokens();

  return (
    <View
      className="flex-1 rounded-2xl border px-4 py-3"
      style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
      <ThemedText className="text-[10px] font-black uppercase text-gray-500">{label}</ThemedText>
      <ThemedText className="mt-1 text-sm font-black" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function ProgressiveHint({
  dashboard,
  insightLevel,
}: {
  dashboard: DashboardResponse;
  insightLevel: number;
}) {
  const theme = useThemeTokens();
  const next =
    insightLevel >= 4
      ? 'Full insight set active'
      : insightLevel === 1
        ? 'Add a few more transactions to unlock category and merchant intelligence.'
        : insightLevel === 2
          ? 'More account-linked transactions will unlock account intelligence.'
          : 'Review items and richer behavior patterns unlock as data variety grows.';

  return (
    <View
      className="rounded-2xl border px-4 py-3"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <ThemedText className="text-xs font-black">Insights Level {insightLevel}</ThemedText>
          <ThemedText className="mt-1 text-[11px] leading-4 text-gray-500">{next}</ThemedText>
        </View>
        <ThemedText className="text-[11px] font-black" style={{ color: theme.colors.accent }}>
          {dashboard.summary.transaction_count} txns
        </ThemedText>
      </View>
      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.max(10, insightLevel * 25)}%`, backgroundColor: theme.colors.accent }}
        />
      </View>
    </View>
  );
}

function SpendingAnalysisCard({
  dashboard,
  onDetails,
}: {
  dashboard: DashboardResponse;
  onDetails: () => void;
}) {
  const theme = useThemeTokens();
  const categories = dashboard.top_categories.slice(0, 2);
  const merchants = dashboard.top_merchants.slice(0, 2);
  const primary = categories[0];
  const primaryMeta = resolveCategoryMetadata(primary?.category);

  return (
    <SectionHeader title="Spending Analysis" actionLabel="Details" onAction={onDetails}>
      <View
        className="rounded-[24px] p-5 shadow-sm"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }}>
        <View className="flex-row items-center">
          <View
            className="mr-5 h-[96px] w-[96px] items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.secondary }}>
            <View
              className="h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ borderColor: primaryMeta.color, borderWidth: 8 }}>
              <ThemedText className="text-center text-[9px]" style={{ color: theme.mode === 'dark' ? 'rgba(255,255,255,0.58)' : '#9CA3AF' }}>
                {primary?.category?.split(' ')[0] ?? 'Spend'}
              </ThemedText>
              <ThemedText className="text-xs font-black" style={{ color: theme.colors.text }}>
                {Math.round(primary?.percentage ?? 0)}%
              </ThemedText>
            </View>
          </View>
          <View className="flex-1 gap-3">
            {categories.map((category) => {
              const meta = resolveCategoryMetadata(category.category);
              const trend = category.change >= 0 ? 'higher' : 'lower';
              return (
                <View key={category.category}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <ThemedText className="text-xs">{category.category}</ThemedText>
                    </View>
                    <ThemedText className="text-xs font-black">
                      {formatMoney(category.amount)}
                    </ThemedText>
                  </View>
                  {Math.abs(category.change) > 0 && (
                    <ThemedText
                      className="mt-1 text-[10px] font-bold"
                      style={{ color: category.change >= 0 ? '#FF6680' : '#00B878' }}>
                      {Math.abs(Math.round(category.change))}% {trend} than last period
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {merchants.length > 0 && (
          <View className="mt-5 pt-4" style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>
            <ThemedText className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
              Top Merchants
            </ThemedText>
            {merchants.map((merchant) => (
              <MerchantRow key={merchant.merchant} merchant={merchant} />
            ))}
          </View>
        )}
      </View>
    </SectionHeader>
  );
}

function MerchantRow({ merchant }: { merchant: DashboardResponse['top_merchants'][number] }) {
  const theme = useThemeTokens();

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-2"
      onPress={() =>
        router.push({
          pathname: '/merchant-history',
          params: { merchant: merchant.merchant },
        })
      }>
      <View className="flex-row items-center">
        <View
          className="mr-3 h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: theme.colors.secondary }}>
          <MaterialCommunityIcons name="storefront-outline" size={16} color={theme.colors.accent} />
        </View>
        <View>
          <ThemedText className="text-xs font-bold">{merchant.merchant}</ThemedText>
          <ThemedText className="text-[10px] text-gray-500">
            {merchant.transaction_count} transactions
          </ThemedText>
        </View>
      </View>
      <ThemedText className="text-xs font-black">{formatMoney(merchant.amount)}</ThemedText>
    </TouchableOpacity>
  );
}

const insightDetailParams = (
  card: InsightCard,
  dashboard: DashboardResponse,
  rangeLabel: string
) => {
  const params: Record<string, string> = {
    kind: card.kind,
    severity: card.severity,
    title: card.title,
    body: card.body,
    start: dashboard.period.start,
    end: dashboard.period.end,
    label: rangeLabel,
  };

  if (card.kind === 'category_increase') {
    const categoryName = card.category ?? card.title.replace(/\s+increased$/i, '').trim();
    const category =
      dashboard.top_categories.find((item) => item.category.toLowerCase() === categoryName.toLowerCase()) ??
      dashboard.top_categories[0];
    if (category) {
      params.category = category.category;
    }
  }
  if (card.category) params.category = card.category;
  if (card.budget_id != null) params.budgetId = String(card.budget_id);
  if (card.amount != null) params.amount = String(card.amount);
  if (card.limit_amount != null) params.limitAmount = String(card.limit_amount);
  if (card.remaining_amount != null) params.remainingAmount = String(card.remaining_amount);
  if (card.status) params.status = card.status;
  if (card.percentage != null) params.percentage = String(card.percentage);
  if (card.change_percentage != null) params.change = String(card.change_percentage);
  if (card.explanation) params.explanation = card.explanation;
  if (card.action_label) params.actionLabel = card.action_label;

  if (card.kind === 'top_merchant') {
    const merchant = card.merchant
      ? dashboard.top_merchants.find((item) => item.merchant === card.merchant)
      : dashboard.top_merchants[0];
    if (merchant) {
      params.merchant = merchant.merchant;
    }
  }
  if (card.merchant) params.merchant = card.merchant;
  if (card.transaction_count != null) params.transactionCount = String(card.transaction_count);

  if (card.kind === 'account_usage') {
    const account = card.account_id != null
      ? dashboard.account_spending.find((item) => item.account_id === card.account_id)
      : dashboard.account_spending[0];
    if (account) {
      params.accountName = account.account_name;
      if (account.account_id != null) params.accountId = String(account.account_id);
    }
  }
  if (card.account_name) params.accountName = card.account_name;
  if (card.account_id != null) params.accountId = String(card.account_id);

  if (card.kind === 'recurring_candidate') {
    const candidate = card.merchant
      ? dashboard.recurring_candidates.find((item) => item.merchant === card.merchant)
      : dashboard.recurring_candidates[0];
    if (candidate) {
      params.merchant = candidate.merchant;
      params.category = candidate.category;
    }
  }
  if (card.next_expected_date) params.nextExpectedDate = card.next_expected_date;
  if (card.confidence != null) params.confidence = String(card.confidence);

  if (card.kind === 'unusual_spending' && !params.amount) {
    const match = card.body.match(/₹([\d,.]+)/);
    if (match?.[1]) params.amount = match[1].replace(/,/g, '');
  }

  return params;
};

function SmartAlerts({
  cards,
  dashboard,
  rangeLabel,
}: {
  cards: InsightCard[];
  dashboard: DashboardResponse;
  rangeLabel: string;
}) {
  if (cards.length === 0) return null;

  return (
    <SectionHeader title="Smart Alerts">
      <View className="gap-3">
        {cards.slice(0, 3).map((card) => (
          <AlertCard
            key={card.kind}
            card={card}
            params={insightDetailParams(card, dashboard, rangeLabel)}
          />
        ))}
      </View>
    </SectionHeader>
  );
}

function RecurringReviewTeaser({
  dashboard,
  rangeLabel,
}: {
  dashboard: DashboardResponse;
  rangeLabel: string;
}) {
  const theme = useThemeTokens();
  const dueCount = dashboard.recurring_candidates.filter((candidate) => candidate.review_due).length;
  const topCandidate = dashboard.recurring_candidates[0];

  return (
    <SectionHeader
      title="Recurring Review"
      actionLabel="Review"
      onAction={() =>
        router.push({
          pathname: '/recurring-review',
          params: {
            start: dashboard.period.start,
            end: dashboard.period.end,
            label: rangeLabel,
          },
        })
      }>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() =>
          router.push({
            pathname: '/recurring-review',
            params: {
              start: dashboard.period.start,
              end: dashboard.period.end,
              label: rangeLabel,
              merchant: topCandidate?.merchant ?? '',
            },
          })
        }
        className="rounded-[24px] border p-5 shadow-sm"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        <View className="flex-row items-start">
          <View
            className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.colors.secondary }}>
            <MaterialCommunityIcons name="repeat-variant" size={23} color={theme.colors.accent} />
          </View>
          <View className="flex-1">
            <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {dueCount > 0 ? `${dueCount} due now` : `${dashboard.recurring_candidates.length} detected`}
            </ThemedText>
            <ThemedText className="mt-1 text-base font-black">
              {topCandidate?.label ?? 'Recurring patterns'}
            </ThemedText>
            <ThemedText className="mt-1 text-xs leading-5 text-gray-500">
              Confirm repeated spends before Finnri tracks them as subscriptions.
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.accent} />
        </View>
      </TouchableOpacity>
    </SectionHeader>
  );
}

function BudgetWatchSection({
  dashboard,
  rangeLabel,
}: {
  dashboard: DashboardResponse;
  rangeLabel: string;
}) {
  const visible = dashboard.budget_statuses
    .filter((budget) => budget.status !== 'safe')
    .slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <SectionHeader title="Budget Watch">
      <View className="gap-3">
        {visible.map((budget) => (
          <BudgetWatchCard
            key={budget.budget_id}
            budget={budget}
            periodStart={dashboard.period.start}
            periodEnd={dashboard.period.end}
            rangeLabel={rangeLabel}
          />
        ))}
      </View>
    </SectionHeader>
  );
}

function BudgetWatchCard({
  budget,
  periodStart,
  periodEnd,
  rangeLabel,
}: {
  budget: DashboardResponse['budget_statuses'][number];
  periodStart: string;
  periodEnd: string;
  rangeLabel: string;
}) {
  const theme = useThemeTokens();
  const exceeded = budget.status === 'exceeded';
  const color = exceeded ? '#FF6680' : '#FFB020';
  const label = budget.category || budget.name;
  const kind = exceeded ? 'budget_exceeded' : 'budget_watch';
  const title = exceeded ? `${label} budget exceeded` : `${label} budget nearing limit`;
  const body = `${formatMoney(budget.spent_amount)} of ${formatMoney(budget.limit_amount)} used with ${budget.days_left} day${budget.days_left === 1 ? '' : 's'} left.`;

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}1A` }}>
              <ThemedText className="text-[10px] font-black uppercase" style={{ color }}>
                {exceeded ? 'Exceeded' : 'Watch'}
              </ThemedText>
            </View>
            <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {budget.days_left} day{budget.days_left === 1 ? '' : 's'} left
            </ThemedText>
          </View>
          <ThemedText className="mt-3 text-base font-black">{label}</ThemedText>
          <ThemedText className="mt-1 text-xs leading-5 text-gray-500">
            {formatMoney(budget.spent_amount)} of {formatMoney(budget.limit_amount)} used
          </ThemedText>
        </View>
        <ThemedText className="text-xl font-black" style={{ color }}>
          {Math.round(budget.percentage)}%
        </ThemedText>
      </View>

      <View className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, budget.percentage)}%`, backgroundColor: color }}
        />
      </View>

      <View className="mt-4 flex-row gap-2">
        <PillButton
          label="Review"
          muted
          onPress={() =>
            router.push({
              pathname: '/insight-detail',
              params: {
                kind,
                severity: 'warning',
                title,
                body,
                explanation:
                  'This compares confirmed expenses in the selected period against your active monthly budget.',
                actionLabel: budget.category ? 'Open category' : 'Review transactions',
                start: periodStart,
                end: periodEnd,
                label: rangeLabel,
                budgetId: String(budget.budget_id),
                category: budget.category,
                amount: String(budget.spent_amount),
                limitAmount: String(budget.limit_amount),
                remainingAmount: String(budget.remaining_amount),
                percentage: String(budget.percentage),
                status: budget.status,
              },
            })
          }
        />
        <PillButton
          label="Adjust"
          onPress={() =>
            router.push({
              pathname: '/budgets',
              params: {
                source: 'insight',
                budgetId: String(budget.budget_id),
                category: budget.category,
                suggestedLimit: String(Math.max(budget.limit_amount, budget.spent_amount)),
              },
            })
          }
        />
      </View>
    </View>
  );
}

function AlertCard({ card, params }: { card: InsightCard; params: Record<string, string> }) {
  const theme = useThemeTokens();
  const isWarning = card.severity === 'warning';
  const color = isWarning ? '#FF6680' : card.severity === 'success' ? '#00B878' : theme.colors.accent;
  const icon = isWarning
    ? 'calendar-alert'
    : card.severity === 'success'
      ? 'check-decagram'
      : 'creation';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.push({ pathname: '/insight-detail', params })}
      className="rounded-[22px] border p-4 shadow-sm"
      style={{
        backgroundColor: theme.colors.card,
        borderLeftColor: color,
        borderLeftWidth: 3,
        borderColor: theme.colors.border,
      }}>
      <View className="flex-row">
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isWarning ? '#FFF3F5' : theme.colors.secondary }}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View className="flex-1">
          <ThemedText className="text-sm font-black">{card.title}</ThemedText>
          <ThemedText className="mt-1 text-xs leading-4 text-gray-500">{card.body}</ThemedText>
          {isWarning && (
            <View className="mt-3 flex-row gap-2">
              <PillButton
                label="View Details"
                muted
                onPress={() => router.push({ pathname: '/insight-detail', params })}
              />
              {params.category && (
                <PillButton
                  label="Set Limit"
                  onPress={() =>
                    router.push({
                      pathname: '/budgets',
                      params: {
                        source: 'insight',
                        budgetId: params.budgetId ?? '',
                        category: params.category,
                        suggestedLimit: params.amount ?? '',
                      },
                    })
                  }
                />
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PillButton({
  label,
  muted,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  const theme = useThemeTokens();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: muted ? (theme.mode === 'dark' ? '#333333' : '#F3F3F3') : theme.colors.accent }}>
      <ThemedText
        className="text-[10px] font-black"
        style={{ color: muted ? theme.colors.text : '#FFFFFF' }}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

function AccountIntelligence({ dashboard }: { dashboard: DashboardResponse }) {
  const theme = useThemeTokens();
  const topCategory = dashboard.top_categories[0]?.category ?? 'Not enough data';
  return (
    <SectionHeader title="Account Intelligence">
      <View
        className="rounded-[24px] border p-5 shadow-sm"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        {dashboard.account_spending.slice(0, 3).map((account) => (
          <View key={account.account_id ?? account.account_name} className="mb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <ThemedText className="text-sm">{account.account_name}</ThemedText>
              <ThemedText className="text-xs text-gray-500">
                {formatMoney(account.amount)} spent
              </ThemedText>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-gray-100">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(account.percentage, 100)}%`,
                  backgroundColor: theme.colors.accent,
                }}
              />
            </View>
          </View>
        ))}

        <View className="mt-2 flex-row gap-3">
          <MiniMetric
            icon="calendar-blank-outline"
            label="Daily Average"
            value={formatMoney(dashboard.summary.daily_average)}
          />
          <MiniMetric icon="chart-bar" label="Top Category" value={topCategory} />
        </View>
      </View>
    </SectionHeader>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useThemeTokens();

  return (
    <View
      className="flex-1 rounded-2xl border p-4"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.colors.accent} />
      <ThemedText className="mt-3 text-[11px] text-gray-500">{label}</ThemedText>
      <ThemedText className="mt-1 text-sm font-black" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function NeedsReview({
  entries,
  totalCount,
  periodStart,
  periodEnd,
}: {
  entries: DashboardResponse['recent_transactions'];
  totalCount: number;
  periodStart: string;
  periodEnd: string;
}) {
  const theme = useThemeTokens();

  return (
    <SectionHeader
      title="Needs Review"
      actionLabel={totalCount > entries.length ? `View all ${totalCount}` : `${totalCount} Items`}
      onAction={() =>
        router.push({
          pathname: '/transactions',
          params: {
            review: '1',
            start_date: periodStart,
            end_date: periodEnd,
          },
        })
      }>
      <View
        className="overflow-hidden rounded-[24px] border shadow-sm"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        {entries.map((entry, index) => {
          const reasons = getReviewReasons(entry);
          return (
            <TouchableOpacity
              key={entry.id ?? `${entry.date}-${index}`}
              activeOpacity={0.78}
              disabled={entry.id == null}
              onPress={() => openDashboardEntryForReview(entry)}
              className={`p-4 ${index < entries.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <View className="flex-row items-start">
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <MaterialCommunityIcons name="help" size={16} color="#9B9692" />
                </View>
                <View className="min-w-0 flex-1 pr-3">
                  <ThemedText className="text-sm font-bold" numberOfLines={1}>
                    {entry.title || entry.merchant || entry.category || 'Transaction'}
                  </ThemedText>
                  <ThemedText className="mt-0.5 text-[11px] text-gray-500">
                    {entry.date || 'No date recorded'}
                  </ThemedText>
                </View>
                <View className="items-end">
                  <ThemedText className="text-sm font-black">
                    {formatMoney(Number(entry.amount || 0))}
                  </ThemedText>
                  <ThemedText className="mt-1 text-[10px] font-bold" style={{ color: theme.colors.accent }}>
                    Resolve
                  </ThemedText>
                </View>
              </View>
              <View className="ml-12 mt-3 flex-row flex-wrap gap-2">
                {reasons.map((reason) => (
                  <View
                    key={reason.label}
                    className="flex-row items-center rounded-full px-2.5 py-1"
                    style={{ backgroundColor: theme.colors.secondary }}>
                    <MaterialCommunityIcons
                      name={reason.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={12}
                      color={theme.colors.accent}
                    />
                    <ThemedText className="ml-1 text-[10px] font-black" style={{ color: theme.colors.accent }}>
                      {reason.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
            </View>
    </SectionHeader>
  );
}

function UnlockCard({
  dashboard,
  insightLevel,
}: {
  dashboard: DashboardResponse;
  insightLevel: number;
}) {
  const theme = useThemeTokens();
  const remaining = insightLevel === 1 ? 3 - dashboard.summary.transaction_count : 1;
  const copy =
    insightLevel === 1
      ? `${Math.max(1, remaining)} more transactions unlock spending analysis.`
      : insightLevel === 2
        ? 'Link spending to accounts to unlock account intelligence.'
        : 'More repeated behavior unlocks deeper review and pattern insights.';
  return (
    <View
      className="rounded-[24px] border border-dashed p-5"
      style={{ backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }}>
      <ThemedText className="text-sm font-black" style={{ color: theme.colors.accent }}>
        More insights are waiting
      </ThemedText>
      <ThemedText className="mt-1 text-xs leading-5 text-gray-500">{copy}</ThemedText>
    </View>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const theme = useThemeTokens();

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-1">
        <ThemedText className="text-lg font-black">{title}</ThemedText>
        {actionLabel && (
          <TouchableOpacity onPress={onAction}>
            <ThemedText className="text-xs font-bold" style={{ color: theme.colors.accent }}>
              {actionLabel}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

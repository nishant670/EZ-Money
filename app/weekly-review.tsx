import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/navigation/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getFriendlyErrorMessage } from '@/lib/api-error';
import { DashboardResponse, fetchDashboard } from '@/lib/insights';

const toParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const formatMoney = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const toApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const defaultWeeklyRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: toApiDate(start), end: toApiDate(end) };
};

const getNeedsReviewCount = (dashboard: DashboardResponse) =>
  (dashboard.review_items ?? dashboard.recent_transactions.filter((entry) => {
    const category = String(entry.category ?? '').trim().toLowerCase();
    return !category || category === 'uncategorized' || !entry.account_id;
  })).length;

export default function WeeklyReviewScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;
  const { token } = useAuthStore();
  const fallbackRange = useMemo(() => defaultWeeklyRange(), []);
  const start = toParam(params.start) ?? fallbackRange.start;
  const end = toParam(params.end) ?? fallbackRange.end;
  const label = toParam(params.label) ?? 'Weekly review';

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchDashboard(token, start, end));
    } catch (loadError) {
      setError(getFriendlyErrorMessage(loadError, 'Unable to load weekly review.'));
    } finally {
      setLoading(false);
    }
  }, [end, start, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const warnings = useMemo(
    () => dashboard?.insights.filter((insight) => insight.severity === 'warning') ?? [],
    [dashboard?.insights]
  );
  const budgetRisks = useMemo(
    () => dashboard?.budget_statuses.filter((budget) => budget.status !== 'safe') ?? [],
    [dashboard?.budget_statuses]
  );
  const recurringDue = useMemo(
    () => dashboard?.recurring_candidates.filter((candidate) => candidate.review_due) ?? [],
    [dashboard?.recurring_candidates]
  );
  const reviewCount = dashboard ? getNeedsReviewCount(dashboard) : 0;
  const topAction = useMemo(() => {
    if (!dashboard) return null;
    if (reviewCount > 0) {
      return {
        title: 'Clean up review items',
        body: `${reviewCount} transaction${reviewCount === 1 ? '' : 's'} need category or account cleanup.`,
        icon: 'playlist-check' as const,
        onPress: () =>
          router.push({
            pathname: '/transactions',
            params: { review: '1', start_date: start, end_date: end },
          }),
      };
    }
    if (budgetRisks.length > 0) {
      const budget = budgetRisks[0];
      return {
        title: `${budget.category || budget.name} budget needs attention`,
        body: `${formatMoney(budget.spent_amount)} of ${formatMoney(budget.limit_amount)} used.`,
        icon: 'chart-donut' as const,
        onPress: () =>
          router.push({
            pathname: '/budgets',
            params: {
              source: 'insight',
              budgetId: String(budget.budget_id),
              category: budget.category,
              suggestedLimit: String(Math.max(budget.limit_amount, budget.spent_amount)),
            },
          }),
      };
    }
    if (recurringDue.length > 0) {
      return {
        title: 'Confirm recurring patterns',
        body: `${recurringDue.length} recurring pattern${recurringDue.length === 1 ? '' : 's'} ready for review.`,
        icon: 'repeat-variant' as const,
        onPress: () => router.push({ pathname: '/recurring-review', params: { start, end } }),
      };
    }
    return {
      title: 'Review spending details',
      body: 'Open the detailed breakdown for categories, merchants, and daily trend.',
      icon: 'chart-line' as const,
      onPress: () => router.push({ pathname: '/spending-analysis', params: { start, end, label } }),
    };
  }, [budgetRisks, dashboard, end, label, recurringDue.length, reviewCount, start]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Weekly review" subtitle={label} onBack={() => router.back()} rightIcon="refresh" onRightPress={load} />

      {loading && !dashboard ? (
        <View className="flex-1 justify-center">
          <StateView icon="file-chart" title="Loading weekly review" message="Building your review from confirmed transactions." loading />
        </View>
      ) : !dashboard ? (
        <View className="flex-1 justify-center">
          <StateView icon={error ? 'wifi-off' : 'file-chart'} title={error ? 'Review did not load' : 'No review yet'} message={error || 'Add transactions to generate a weekly review.'} actionLabel="Try again" onAction={load} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110, gap: 16 }}>
          {error && (
            <View className="rounded-2xl border border-red-100 bg-red-50 p-3">
              <ThemedText className="text-center text-sm text-red-600">{error}</ThemedText>
            </View>
          )}

          <View className="rounded-[28px] border p-5 shadow-sm" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">This period</ThemedText>
            <ThemedText className="mt-2 text-4xl font-black">{formatMoney(dashboard.summary.total_spent)}</ThemedText>
            <ThemedText className="mt-1 text-xs" style={{ color: muted }}>
              {dashboard.summary.transaction_count} confirmed transactions · {formatMoney(dashboard.summary.daily_average)}/day
            </ThemedText>
            <View className="mt-5 flex-row gap-3">
              <MiniStat label="Income" value={formatMoney(dashboard.summary.total_income)} />
              <MiniStat label="Budgets" value={String(budgetRisks.length)} />
              <MiniStat label="Recurring" value={String(recurringDue.length)} />
            </View>
          </View>

          {topAction && (
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={topAction.onPress}
              className="rounded-[24px] border p-5"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <View className="flex-row items-start gap-4">
                <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.secondary }}>
                  <MaterialCommunityIcons name={topAction.icon} size={23} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">Next action</ThemedText>
                  <ThemedText className="mt-1 text-lg font-black">{topAction.title}</ThemedText>
                  <ThemedText className="mt-1 text-xs leading-5" style={{ color: muted }}>{topAction.body}</ThemedText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent} />
              </View>
            </TouchableOpacity>
          )}

          <ReviewSection title="Highlights">
            <ReviewRow
              icon="shape-outline"
              title={dashboard.top_categories[0]?.category ?? 'No category leader'}
              body={dashboard.top_categories[0] ? `${formatMoney(dashboard.top_categories[0].amount)} · ${Math.round(dashboard.top_categories[0].percentage)}% of spend` : 'More transactions will reveal a category pattern.'}
            />
            <ReviewRow
              icon="storefront-outline"
              title={dashboard.top_merchants[0]?.merchant ?? 'No merchant leader'}
              body={dashboard.top_merchants[0] ? `${formatMoney(dashboard.top_merchants[0].amount)} across ${dashboard.top_merchants[0].transaction_count} transaction(s)` : 'Merchant insights appear after merchant-tagged expenses.'}
            />
          </ReviewSection>

          {(budgetRisks.length > 0 || recurringDue.length > 0 || warnings.length > 0) && (
            <ReviewSection title="Needs Attention">
              {budgetRisks.slice(0, 2).map((budget) => (
                <ReviewRow
                  key={`budget-${budget.budget_id}`}
                  icon="chart-donut"
                  title={`${budget.category || budget.name} budget ${budget.status}`}
                  body={`${Math.round(budget.percentage)}% used · ${formatMoney(budget.remaining_amount)} left`}
                />
              ))}
              {recurringDue.slice(0, 2).map((candidate) => (
                <ReviewRow
                  key={`recurring-${candidate.candidate_key}`}
                  icon="repeat-variant"
                  title={candidate.label}
                  body={`${formatMoney(candidate.average_amount)} expected around ${candidate.next_expected_date}`}
                />
              ))}
              {warnings.slice(0, 2).map((warning) => (
                <ReviewRow key={`warning-${warning.kind}-${warning.title}`} icon="alarm-light-outline" title={warning.title} body={warning.body} />
              ))}
            </ReviewSection>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View className="flex-1 rounded-2xl border px-3 py-3" style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
      <ThemedText className="text-[10px] font-black uppercase text-gray-500">{label}</ThemedText>
      <ThemedText className="mt-1 text-sm font-black" numberOfLines={1}>{value}</ThemedText>
    </View>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useThemeTokens();
  return (
    <View>
      <ThemedText className="mb-3 px-1 text-lg font-black">{title}</ThemedText>
      <View className="overflow-hidden rounded-[24px] border" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        {children}
      </View>
    </View>
  );
}

function ReviewRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}) {
  const theme = useThemeTokens();
  return (
    <View className="flex-row items-center border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-700">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.colors.secondary }}>
        <MaterialCommunityIcons name={icon} size={19} color={theme.colors.accent} />
      </View>
      <View className="flex-1">
        <ThemedText className="text-sm font-black" numberOfLines={1}>{title}</ThemedText>
        <ThemedText className="mt-1 text-xs leading-5 text-gray-500" numberOfLines={2}>{body}</ThemedText>
      </View>
    </View>
  );
}

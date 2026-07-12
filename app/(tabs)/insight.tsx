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

const getHealthScore = (dashboard: DashboardResponse) => {
  const { total_income: income, total_spent: spent } = dashboard.summary;
  if (income <= 0 && spent <= 0) return 0;
  if (income <= 0) return 55;
  const savingsRate = Math.max(0, (income - spent) / income);
  return Math.min(95, Math.max(35, Math.round(45 + savingsRate * 100)));
};

const getHealthLabel = (score: number, dashboard: DashboardResponse) => {
  if (dashboard.summary.transaction_count === 0) return 'Waiting for data';
  if (score >= 70) return 'Good Standing';
  if (score >= 50) return 'Watch Closely';
  return 'Needs Attention';
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

const getNeedsReview = (dashboard: DashboardResponse) =>
  dashboard.recent_transactions
    .filter((entry) => {
      const category = String(entry.category ?? '')
        .trim()
        .toLowerCase();
      return !category || category === 'uncategorized' || !entry.account_id;
    })
    .slice(0, 3);

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

        <FinancialHealthCard dashboard={dashboard} insightLevel={insightLevel} />

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

        {insightLevel >= 2 && <SmartAlerts cards={dashboard.insights} />}

        {insightLevel >= 3 && <AccountIntelligence dashboard={dashboard} />}

        {reviewItems.length > 0 && <NeedsReview entries={reviewItems} />}

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

function FinancialHealthCard({
  dashboard,
  insightLevel,
}: {
  dashboard: DashboardResponse;
  insightLevel: number;
}) {
  const theme = useThemeTokens();
  const accentSurface = theme.mode === 'dark' ? theme.colors.secondary : theme.colors.secondary;
  const score = getHealthScore(dashboard);
  const label = getHealthLabel(score, dashboard);
  const change = dashboard.top_categories[0]?.change ?? 0;
  const changeCopy =
    change === 0
      ? 'Building your baseline'
      : `${Math.abs(Math.round(change))}% ${change < 0 ? 'better' : 'higher'} than last period`;

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Financial Health
          </ThemedText>
          <ThemedText className="mt-1 text-2xl font-black">{label}</ThemedText>
          <ThemedText
            className="mt-1 text-[11px] font-bold"
            style={{ color: change < 0 ? '#00B878' : '#FF6B6B' }}>
            {changeCopy}
          </ThemedText>
        </View>
        <ScoreRing score={score} />
      </View>

      <View className="mt-7 flex-row gap-5">
        <MetricWithStripe
          label="Total Income"
          value={formatMoney(dashboard.summary.total_income)}
          color="#00B878"
        />
        <MetricWithStripe
          label="Total Spent"
          value={formatMoney(dashboard.summary.total_spent)}
          color="#FF6680"
        />
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
                Burn Rate:{' '}
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

function ScoreRing({ score }: { score: number }) {
  const theme = useThemeTokens();

  return (
    <View
      className="h-[72px] w-[72px] items-center justify-center rounded-full"
      style={{ backgroundColor: theme.colors.secondary }}>
      <View
        className="h-[58px] w-[58px] items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.card }}>
        <ThemedText className="text-xs font-black" style={{ color: theme.colors.accent }}>
          {score}%
        </ThemedText>
      </View>
    </View>
  );
}

function MetricWithStripe({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-1 flex-row items-center">
      <View className="mr-3 h-12 w-2 rounded-full" style={{ backgroundColor: color }} />
      <View>
        <ThemedText className="text-[11px] text-gray-500">{label}</ThemedText>
        <ThemedText className="mt-1 text-lg font-black">{value}</ThemedText>
      </View>
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

function SmartAlerts({ cards }: { cards: InsightCard[] }) {
  if (cards.length === 0) return null;

  return (
    <SectionHeader title="Smart Alerts">
      <View className="gap-3">
        {cards.slice(0, 3).map((card) => (
          <AlertCard key={card.kind} card={card} />
        ))}
      </View>
    </SectionHeader>
  );
}

function AlertCard({ card }: { card: InsightCard }) {
  const theme = useThemeTokens();
  const isWarning = card.severity === 'warning';
  const color = isWarning ? '#FF6680' : card.severity === 'success' ? '#00B878' : theme.colors.accent;
  const icon = isWarning
    ? 'calendar-alert'
    : card.severity === 'success'
      ? 'check-decagram'
      : 'creation';

  return (
    <View
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
              <PillButton label="View Details" muted />
              <PillButton label="Set Limit" />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function PillButton({ label, muted }: { label: string; muted?: boolean }) {
  const theme = useThemeTokens();

  return (
    <TouchableOpacity
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

function NeedsReview({ entries }: { entries: DashboardResponse['recent_transactions'] }) {
  const theme = useThemeTokens();

  return (
    <SectionHeader title="Needs Review" actionLabel={`${entries.length} Items`}>
      <View
        className="overflow-hidden rounded-[24px] border shadow-sm"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        {entries.map((entry, index) => (
          <View
            key={entry.id ?? `${entry.date}-${index}`}
            className={`flex-row items-center p-4 ${index < entries.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100">
              <MaterialCommunityIcons name="help" size={16} color="#9B9692" />
            </View>
            <View className="flex-1 pr-3">
              <ThemedText className="text-sm font-bold">
                {entry.title || entry.merchant || entry.category || 'Transaction'}
              </ThemedText>
              <ThemedText className="text-[11px] text-gray-500">
                {!entry.account_id ? 'Missing account' : 'Uncategorized'} • {entry.date}
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
        ))}
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

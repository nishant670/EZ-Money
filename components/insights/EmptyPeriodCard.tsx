import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DashboardOverview, DashboardOverviewMonth } from '@/lib/insights';
import { formatMoney } from '@/lib/money';

/**
 * What the tab says when the selected period holds nothing but the account
 * does not.
 *
 * The screen used to answer that case with its ordinary cards, filled with
 * zeros: "₹0 per day", "Waiting for data", four ₹0 tiles. Every one of those is
 * a true statement about an empty window and a false impression of the account,
 * and it is the state the tab is guaranteed to be in at the start of every
 * month — which is exactly when somebody opens it to plan.
 *
 * Three things instead, in the order they are useful:
 *
 *  1. Name the state plainly, so it reads as a quiet window and not a fault.
 *  2. Say what the month is measured against, so the emptiness has a size.
 *  3. Offer the one tap that leads somewhere — the last month that has data.
 */
export function EmptyPeriodCard({
  rangeLabel,
  overview,
  onOpenMonth,
  onAddTransaction,
}: {
  rangeLabel: string;
  overview: DashboardOverview;
  onOpenMonth: (month: DashboardOverviewMonth) => void;
  onAddTransaction: () => void;
}) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const lastActive = overview.last_active_month ?? null;
  const typical = overview.typical_monthly_spend || overview.average_monthly_spend;
  // Same floor as the band above: below three complete months there is no
  // "typical" to quote, and quoting one anyway printed the same figure twice —
  // once here and once on the jump button — which reads as a bug.
  const canClaimTypical = (overview.baseline_months ?? 0) >= 3 && typical > 0;

  return (
    <View
      className="rounded-3xl border p-5"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: theme.secondary }}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={20} color={theme.accent} />
        </View>
        <View className="flex-1">
          <ThemedText
            className="text-xs uppercase"
            style={{ color: theme.mutedStrong, fontFamily: Fonts.title, letterSpacing: 0.6 }}>
            Nothing yet
          </ThemedText>
          <ThemedText
            className="mt-1 text-lg"
            style={{ color: theme.text, fontFamily: Fonts.title }}>
            No transactions in {rangeLabel}
          </ThemedText>
        </View>
      </View>

      <ThemedText className="mt-3 text-sm leading-5" style={{ color: theme.muted }}>
        {canClaimTypical
          ? `Your history is intact — a typical month runs about ${formatMoney(
              typical
            )}. Insights for this period fill in as you capture transactions.`
          : 'Your history is intact. Insights for this period fill in as you capture transactions.'}
      </ThemedText>

      {lastActive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show ${lastActive.label}, ${formatMoney(lastActive.spent)} spent`}
          onPress={() => onOpenMonth(lastActive)}
          className="mt-4 flex-row items-center justify-between rounded-2xl px-4 py-3"
          style={{ backgroundColor: theme.secondary }}>
          <View className="flex-1 pr-3">
            <ThemedText
              className="text-sm"
              style={{ color: theme.accent, fontFamily: Fonts.title }}>
              Jump to {lastActive.label}
            </ThemedText>
            <ThemedText className="mt-1 text-xs" style={{ color: theme.muted }} numberOfLines={1}>
              {formatMoney(lastActive.spent)} across {lastActive.count} transaction
              {lastActive.count === 1 ? '' : 's'}
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.accent} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onAddTransaction}
        className="mt-3 flex-row items-center gap-2 self-start"
        hitSlop={8}>
        <MaterialCommunityIcons name="plus-circle-outline" size={16} color={theme.accent} />
        <ThemedText className="text-sm" style={{ color: theme.accent, fontFamily: Fonts.title }}>
          Add a transaction
        </ThemedText>
      </Pressable>
    </View>
  );
}

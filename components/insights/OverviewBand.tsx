import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import { useState } from 'react';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DashboardOverview, DashboardOverviewMonth } from '@/lib/insights';
import { formatMoney, formatMoneyCompact } from '@/lib/money';

/**
 * The standing band at the top of Insights: what is true whatever period is
 * selected.
 *
 * Insights was period-scoped end to end, so it went blank on a schedule —
 * every month, from the 1st until the first transaction was captured, an
 * account with a year of history rendered ₹0 four times over "Waiting for
 * data". That is not an insight about the user's money; it is the lens
 * reporting on itself.
 *
 * Two jobs, in this order:
 *
 *  1. **A floor.** Once there is any history the tab always has something real
 *     at the top, so opening it on the 1st of a month is never a dead screen.
 *  2. **A baseline.** A month in isolation says almost nothing — ₹42,000 is
 *     high or low only against the months around it. The strip is what makes
 *     the selected period legible, which is the more valuable of the two even
 *     in a month that is full.
 *
 * Tapping a bar moves the whole screen to that month, so the band is also the
 * fastest way to navigate the history it is describing.
 */

const CHART_HEIGHT = 64;
const MIN_BAR_HEIGHT = 3;
const BAR_RADIUS = 3;
const BAR_GAP = 4;

export function OverviewBand({
  overview,
  /** YYYY-MM of the period on screen, when it is a single month. */
  selectedMonth,
  onSelectMonth,
}: {
  overview: DashboardOverview;
  selectedMonth: string | null;
  onSelectMonth: (month: DashboardOverviewMonth) => void;
}) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const [width, setWidth] = useState(0);

  const months = overview.recent_months ?? [];
  const ceiling = useMemo(
    () => Math.max(1, ...months.map((month) => month.spent)),
    [months]
  );

  if (!overview.has_history || months.length === 0) return null;

  const barWidth =
    width > 0 ? Math.max(4, (width - BAR_GAP * (months.length - 1)) / months.length) : 0;

  // A median rather than a mean: one holiday or one insurance renewal drags a
  // six-month average far enough to make every ordinary month look frugal
  // against it, which is the opposite of what a baseline is for.
  const typical = overview.typical_monthly_spend || overview.average_monthly_spend;

  /**
   * Whether there is enough history to call anything "typical".
   *
   * Two complete months is a sample, not a habit — and with one holiday in it
   * the median swings further than the figure it replaces. Below the floor the
   * band leads with what is simply true instead: how much has been tracked.
   */
  const baselineMonths = overview.baseline_months ?? 0;
  const canClaimTypical = baselineMonths >= 3 && typical > 0;

  const categoryMonths = overview.top_category_months ?? 0;

  return (
    <View
      className="rounded-3xl border p-5"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={theme.accent} />
        <ThemedText
          className="text-xs uppercase"
          style={{ color: theme.mutedStrong, fontFamily: Fonts.title, letterSpacing: 0.6 }}>
          Your money so far
        </ThemedText>
      </View>

      <View className="mt-3 flex-row items-end justify-between gap-4">
        <View className="flex-1">
          <ThemedText className="text-2xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
            {formatMoney(canClaimTypical ? typical : overview.lifetime_spent)}
          </ThemedText>
          <ThemedText className="mt-1 text-xs" style={{ color: theme.muted }}>
            {canClaimTypical
              ? `in a typical month · last ${baselineMonths} months`
              : 'tracked so far'}
          </ThemedText>
        </View>
        <View className="items-end">
          <ThemedText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
            {canClaimTypical
              ? formatMoneyCompact(overview.lifetime_spent)
              : String(overview.lifetime_transaction_count)}
          </ThemedText>
          <ThemedText className="mt-1 text-xs" style={{ color: theme.muted }}>
            {canClaimTypical
              ? `over ${overview.months_tracked} month${overview.months_tracked === 1 ? '' : 's'}`
              : `transaction${overview.lifetime_transaction_count === 1 ? '' : 's'} in ${
                  overview.months_tracked
                } month${overview.months_tracked === 1 ? '' : 's'}`}
          </ThemedText>
        </View>
      </View>

      <View
        className="mt-4"
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {barWidth > 0 ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              {months.map((month, index) => {
                const height =
                  month.spent > 0
                    ? Math.max(MIN_BAR_HEIGHT, (month.spent / ceiling) * CHART_HEIGHT)
                    : MIN_BAR_HEIGHT;
                const selected = month.month === selectedMonth;
                return (
                  <Rect
                    key={month.month}
                    x={index * (barWidth + BAR_GAP)}
                    y={CHART_HEIGHT - height}
                    width={barWidth}
                    height={height}
                    rx={BAR_RADIUS}
                    // A month with nothing in it is drawn as an empty slot
                    // rather than dropped. Dropping it compresses time, and a
                    // gap then reads as a decline.
                    fill={
                      selected
                        ? theme.accent
                        : month.spent > 0
                          ? theme.secondary
                          : theme.border
                    }
                  />
                );
              })}
            </Svg>
            {/* Touch targets are separate from the bars: a two-pixel-wide
                quiet month still has to be reachable, and a bar is only as
                tall as its own amount. */}
            <View className="absolute inset-0 flex-row" style={{ gap: BAR_GAP }}>
              {months.map((month) => (
                <Pressable
                  key={month.month}
                  accessibilityRole="button"
                  accessibilityLabel={`${month.label}, ${
                    month.count > 0 ? formatMoney(month.spent) : 'no transactions'
                  }`}
                  onPress={() => onSelectMonth(month)}
                  style={{ width: barWidth, height: CHART_HEIGHT }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}

        <View className="mt-2 flex-row" style={{ gap: BAR_GAP }}>
          {months.map((month) => (
            <ThemedText
              key={month.month}
              numberOfLines={1}
              className="text-center text-[9px]"
              style={{
                width: barWidth,
                color: month.month === selectedMonth ? theme.accent : theme.muted,
              }}>
              {month.label.slice(0, 1)}
            </ThemedText>
          ))}
        </View>
      </View>

      {overview.top_category ? (
        <ThemedText className="mt-3 text-xs leading-5" style={{ color: theme.muted }}>
          {/* The window asks for six months; an account three months old has
              three, and "over six months" would describe a period half of which
              it was not being used for. */}
          {overview.top_category} is your biggest category
          {categoryMonths > 1 ? ` over ${categoryMonths} months` : ''} —{' '}
          {formatMoney(overview.top_category_amount)}, {Math.round(overview.top_category_share)}% of
          what you spent.
        </ThemedText>
      ) : null}
    </View>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { categoryVisual } from '@/lib/categories';
import {
  formatChangeMagnitude,
  previousWindowLabel,
  type DashboardResponse,
} from '@/lib/insights';
import { formatMoney } from '@/lib/money';

/**
 * The month, at the top of Home.
 *
 * Home held no money at all — no balance, no month-to-date, no budget, just a
 * microphone. There was nothing to open the app for on a day you had nothing to
 * log. Three figures, one line each: what you have spent, how that compares
 * with the same days of last month, and where most of it went.
 *
 * Every number comes from `/v1/dashboard` over its default range, which is the
 * 1st to today — the same window the Insights tab opens on, so tapping through
 * cannot land on a different period than the strip described.
 *
 * The comparison obeys S5's floor: below ₹500 or 5 transactions in the previous
 * window the backend sends no percentage, and this says why instead of printing
 * a 0% that would read as "flat".
 */

const monthLabel = (isoDate?: string) => {
  const match = isoDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'This month';
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString('en-US', {
    month: 'long',
  });
};

type MonthStripProps = {
  dashboard: DashboardResponse | null;
  loading: boolean;
  onPress: () => void;
};

export function MonthStrip({ dashboard, loading, onPress }: MonthStripProps) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;

  // A secondary widget must not report a failure on the primary screen. With
  // nothing to show, Home is exactly what it was before this strip existed.
  if (!dashboard && !loading) return null;

  const month = monthLabel(dashboard?.period?.start);

  /**
   * A month with nothing in it is a line, not a panel.
   *
   * This used to be the full card — border, chevron, 24px headline — wrapped
   * around the words "Nothing logged yet". A card is a promise that there is
   * something inside it worth the space and worth a tap, and on a brand-new
   * account both are false: the chevron opened an Insights screen as empty as
   * the card, and the panel pushed the capture field the user actually needs a
   * third of the way down the screen. One quiet sentence says the same thing
   * and gets out of the way; the card comes back with the first expense.
   */
  if (dashboard && dashboard.summary.transaction_count === 0) {
    return (
      <View className="mx-6 mb-4">
        <ThemedText className="text-sm opacity-60">
          Nothing logged in {month} yet — your first expense starts the story.
        </ThemedText>
      </View>
    );
  }

  const body = () => {
    if (!dashboard) {
      return (
        <ThemedText className="mt-1 text-sm opacity-50">Adding up your month…</ThemedText>
      );
    }

    const { summary, top_categories: topCategories, period } = dashboard;

    const previousWindow = previousWindowLabel(period);
    const change = summary.spend_change ?? 0;
    const increased = change >= 0;
    const topCategory = topCategories?.[0];
    const categoryIcon = topCategory ? categoryVisual(topCategory.category) : null;

    return (
      <>
        {/* lineHeight is not optional here. ThemedText's default style sets
            `lineHeight: 21` for its 14px body size, and a className only
            changes fontSize — so a 30px number renders inside a 21px line box
            and everything below the baseline is clipped. Digits have no
            descenders so they look fine; the grouping comma loses its tail and
            `₹40,486` reads as `₹40.486`. The account detail hero hit the same
            trap and pins its line height for the same reason. */}
        <ThemedText
          className="mt-1 text-[30px]"
          style={{ fontFamily: Fonts.title, color: theme.text, lineHeight: 40 }}>
          {formatMoney(summary.total_spent)}
        </ThemedText>

        <View className="mt-1.5 flex-row items-center gap-1.5">
          {summary.spend_change_comparable ? (
            <>
              <MaterialCommunityIcons
                name={increased ? 'trending-up' : 'trending-down'}
                size={15}
                color={increased ? '#EF4444' : '#16A34A'}
              />
              <ThemedText
                className="text-sm"
                style={{ fontFamily: Fonts.title, color: increased ? '#EF4444' : '#16A34A' }}>
                {`${formatChangeMagnitude(change)} ${increased ? 'more' : 'less'}`}
              </ThemedText>
              <ThemedText className="flex-1 text-sm opacity-60" numberOfLines={1}>
                than {previousWindow}
              </ThemedText>
            </>
          ) : (
            <ThemedText className="flex-1 text-sm opacity-60" numberOfLines={1}>
              {(summary.previous_total_spent ?? 0) > 0
                ? `Too little in ${previousWindow} to compare`
                : `Nothing logged in ${previousWindow} to compare`}
            </ThemedText>
          )}
        </View>

        {topCategory && categoryIcon && (
          <View className="mt-1.5 flex-row items-center gap-1.5">
            <MaterialCommunityIcons
              name={categoryIcon.icon}
              size={15}
              color={categoryIcon.color}
            />
            <ThemedText className="text-sm" style={{ fontFamily: Fonts.title, color: theme.text }}>
              {topCategory.category}
            </ThemedText>
            <ThemedText className="flex-1 text-sm opacity-60" numberOfLines={1}>
              {formatMoney(topCategory.amount)} · most of your spend
            </ThemedText>
          </View>
        )}
      </>
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${month} so far. Open insights.`}
      onPress={onPress}
      className="mx-6 mb-4 rounded-3xl border px-5 py-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="flex-row items-center justify-between">
        <ThemedText
          className="text-[11px] uppercase opacity-50"
          style={{ fontFamily: Fonts.title, letterSpacing: 0.8 }}>
          {month} so far
        </ThemedText>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text} opacity={0.4} />
      </View>
      {body()}
    </Pressable>
  );
}

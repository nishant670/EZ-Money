import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const months = [
  { id: '2025-01', label: 'January 2025' },
  { id: '2025-02', label: 'February 2025' },
  { id: '2025-03', label: 'March 2025' },
];

const stats = [
  {
    id: 'spend',
    label: 'Total Spend',
    amount: 25400,
    currency: '₹',
  },
  {
    id: 'savings',
    label: 'Net Savings',
    amount: 12800,
    currency: '₹',
    positive: true,
  },
];

const categories = [
  { id: 'dining', label: 'Dining', amount: 8200, color: '#6C8DFF' },
  { id: 'shopping', label: 'Shopping', amount: 6500, color: '#9F7AEA' },
  { id: 'bills', label: 'Bills', amount: 5100, color: '#F6C85F' },
  { id: 'transport', label: 'Transport', amount: 3400, color: '#4ABA9A' },
  { id: 'other', label: 'Other', amount: 2200, color: '#F47373' },
];

const insights = [
  {
    id: 'dining',
    title: 'Your dining spend is up 12% this month.',
    body: 'This is compared to your average spending in the last 3 months.',
    icon: 'trending-up',
    iconColor: '#F47373',
  },
  {
    id: 'savings',
    title: "You're saving 8% more than your average.",
    body: "Keep up the great work! You're on track to meet your financial goals.",
    icon: 'piggy-bank',
    iconColor: '#4ABA9A',
  },
];

const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
};

export default function InsightScreen() {
  const [selectedMonth, setSelectedMonth] = useState(months[1].id);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const accent = useThemeColor({}, 'accent');

  const surfaceColor = useMemo(
    () => (colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E'),
    [colorScheme]
  );

  const borderColor = useMemo(
    () => (colorScheme === 'light' ? theme.border : '#2E2E2E'),
    [colorScheme, theme.border]
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={[styles.topIcon, { borderColor }]}>
            <MaterialCommunityIcons
              name="currency-usd"
              size={18}
              color={theme.text}
            />
          </View>
          <ThemedText style={styles.topTitle}>Overview</ThemedText>
          <View style={[styles.topIcon, { borderColor }]}>
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={20}
              color={theme.text}
            />
          </View>
        </View>

        <View style={styles.monthSelector}>
          {months.map((month) => {
            const isSelected = month.id === selectedMonth;
            return (
              <Pressable
                key={month.id}
                accessibilityRole="button"
                onPress={() => setSelectedMonth(month.id)}
                style={[
                  styles.monthPill,
                  {
                    backgroundColor: isSelected ? theme.text : surfaceColor,
                    borderColor,
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.monthLabel,
                    {
                      color: isSelected ? theme.background : theme.text,
                    },
                  ]}>
                  {month.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View
              key={stat.id}
              style={[
                styles.statCard,
                { backgroundColor: surfaceColor, borderColor },
              ]}>
              <ThemedText
                style={styles.statLabel}
                lightColor="rgba(26,26,26,0.65)"
                darkColor="rgba(250,250,250,0.65)">
                {stat.label}
              </ThemedText>
              <ThemedText
                type="title"
                style={[
                  styles.statValue,
                  {
                    color: stat.positive ? accent : theme.text,
                  },
                ]}>
                {stat.currency}
                {stat.amount.toLocaleString('en-IN')}
              </ThemedText>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.categoryCard,
            { backgroundColor: surfaceColor, borderColor },
          ]}>
          <ThemedText style={styles.sectionTitle}>
            Spending by Category
          </ThemedText>

          <View
            style={[
              styles.chartPlaceholder,
              { backgroundColor: colorScheme === 'light' ? '#E9EFEA' : '#2A2A2A' },
            ]}>
            <MaterialCommunityIcons
              name="chart-donut"
              size={140}
              color={accent}
            />
          </View>

          <View style={styles.legend}>
            {categories.map((category) => (
              <View key={category.id} style={styles.legendRow}>
                <View style={styles.legendLabel}>
                  <View
                    style={[styles.legendDot, { backgroundColor: category.color }]}
                  />
                  <ThemedText style={styles.legendText}>
                    {category.label}
                  </ThemedText>
                </View>
                <ThemedText style={styles.legendAmount}>
                  ₹{category.amount.toLocaleString('en-IN')}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.insightsStack}>
          {insights.map((insight) => (
            <View
              key={insight.id}
              style={[
                styles.insightCard,
                { backgroundColor: surfaceColor, borderColor },
              ]}>
              <View style={styles.insightHeader}>
                <ThemedText
                  style={styles.insightLabel}
                  lightColor="rgba(26,26,26,0.6)"
                  darkColor="rgba(250,250,250,0.6)">
                  Your Insights
                </ThemedText>
                <View
                  style={[
                    styles.insightIcon,
                    {
                      backgroundColor: `${insight.iconColor}22`,
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={insight.icon}
                    size={20}
                    color={insight.iconColor}
                  />
                </View>
              </View>
              <ThemedText style={styles.insightTitle}>{insight.title}</ThemedText>
              <ThemedText
                style={styles.insightBody}
                lightColor="rgba(26,26,26,0.6)"
                darkColor="rgba(250,250,250,0.7)">
                {insight.body}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg * 2,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  monthPill: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 14,
    fontFamily: Fonts.title,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  statValue: {
    fontSize: 28,
    fontFamily: Fonts.title,
  },
  categoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.title,
  },
  chartPlaceholder: {
    borderRadius: 24,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  legendAmount: {
    fontSize: 14,
    fontFamily: Fonts.title,
  },
  insightsStack: {
    gap: spacing.sm,
  },
  insightCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  insightBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
});

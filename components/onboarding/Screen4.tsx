import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Screen4() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.visualContainer}>
          {/* Monthly Spend Card */}
          <View style={[styles.mainCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.iconLabel}>
                <MaterialCommunityIcons name="calendar-month" size={16} color={theme.accent} />
                <Text style={[styles.label, { color: theme.text, opacity: 0.6 }]}>Monthly Spend</Text>
              </View>
              <View style={[styles.monthBadge, { backgroundColor: theme.accent + '20' }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.accent }}>
                  This month
                </Text>
              </View>
            </View>
            <Text style={[styles.amount, { color: theme.text }]}>₹24,500</Text>
            <View style={styles.chartContainer}>
              {[0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.7].map((h, i) => (
                <View key={i} style={[styles.bar, { height: h * 40, backgroundColor: i === 5 ? theme.accent : '#F0E5E7' }]} />
              ))}
            </View>
          </View>

          {/* Floating Budget Card */}
          <View style={[styles.floatingCard, styles.splitCard, { backgroundColor: theme.card }]}>
            <View style={styles.splitHeader}>
              <MaterialCommunityIcons name="target" size={16} color="#4A90E2" />
              <Text style={[styles.floatingCardTitle, { color: theme.text }]}>Budget</Text>
            </View>
            <Text style={[styles.budgetCategory, { color: theme.text }]}>Food &amp; dining</Text>
            <View style={[styles.budgetTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.budgetFill, { backgroundColor: theme.accent }]} />
            </View>
            <Text style={[styles.budgetMeta, { color: theme.text }]}>₹6,200 of ₹8,000</Text>
          </View>

          {/* Floating Subscription Card */}
          <View style={[styles.floatingCard, styles.accountsCard, { backgroundColor: theme.card }]}>
            <View style={styles.splitHeader}>
              <MaterialCommunityIcons name="autorenew" size={16} color="#B088FF" />
              <Text style={[styles.floatingCardTitle, { color: theme.text }]}>Renews soon</Text>
            </View>
            <View style={styles.accountRow}>
              <View style={[styles.accIcon, { backgroundColor: theme.border }]}>
                <MaterialCommunityIcons name="play-circle" size={14} color="#B088FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subscriptionName, { color: theme.text }]}>Netflix</Text>
                <Text style={[styles.subscriptionMeta, { color: theme.text }]}>in 3 days</Text>
              </View>
              <Text style={[styles.subscriptionAmount, { color: theme.text }]}>₹649</Text>
            </View>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.title }]}>
            It keeps watch,{('\n')}<Text style={{ color: theme.accent }}>so you don&apos;t have to</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: Fonts.body }]}>
            Budgets that warn you early, subscriptions caught before they renew, and a weekly
            review of where the month actually went.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  visualContainer: {
    width: '100%',
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  mainCard: {
    width: 220,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 25,
    elevation: 5,
    zIndex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 15,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 4,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  floatingCard: {
    position: 'absolute',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  splitCard: {
    right: 10,
    bottom: 60,
    width: 150,
    zIndex: 2,
  },
  accountsCard: {
    left: 10,
    bottom: 20,
    width: 160,
    zIndex: 3,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  floatingCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  budgetCategory: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.7,
    marginBottom: 6,
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budgetFill: {
    // 78% spent: far enough along to be the reason a warning exists.
    width: '78%',
    height: '100%',
    borderRadius: 3,
  },
  budgetMeta: {
    fontSize: 9,
    opacity: 0.5,
    marginTop: 5,
    fontWeight: '600',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionName: {
    fontSize: 11,
    fontWeight: '700',
  },
  subscriptionMeta: {
    fontSize: 9,
    opacity: 0.5,
    marginTop: 1,
  },
  subscriptionAmount: {
    fontSize: 11,
    fontWeight: '800',
  },
  textGroup: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

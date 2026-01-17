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
                <View style={[styles.monthBadge, { backgroundColor: '#F0F0F0' }]}>
                   <Text style={{ fontSize: 10, fontWeight: '600' }}>Oct</Text>
                </View>
             </View>
             <Text style={[styles.amount, { color: theme.text }]}>$2,450</Text>
             <View style={styles.chartContainer}>
                {[0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.7].map((h, i) => (
                    <View key={i} style={[styles.bar, { height: h * 40, backgroundColor: i === 5 ? theme.accent : '#F0E5E7' }]} />
                ))}
             </View>
          </View>

          {/* Floating Category Split Card */}
          <View style={[styles.floatingCard, styles.splitCard, { backgroundColor: theme.card }]}>
             <View style={styles.splitHeader}>
                <MaterialCommunityIcons name="chart-donut" size={16} color="#4A90E2" />
                <Text style={{ fontSize: 11, fontWeight: '700', marginLeft: 6 }}>Category Split</Text>
             </View>
             <View style={styles.splitContent}>
                <View style={styles.donut} />
                <View style={styles.splitLabels}>
                   <View style={styles.splitRow}>
                      <View style={[styles.splitDot, { backgroundColor: theme.accent }]} />
                      <Text style={styles.splitText}>Food</Text>
                      <Text style={styles.splitValue}>60%</Text>
                   </View>
                   <View style={styles.splitRow}>
                      <View style={[styles.splitDot, { backgroundColor: '#4A90E2' }]} />
                      <Text style={styles.splitText}>Home</Text>
                      <Text style={styles.splitValue}>25%</Text>
                   </View>
                </View>
             </View>
          </View>

          {/* Floating Accounts Card */}
          <View style={[styles.floatingCard, styles.accountsCard, { backgroundColor: theme.card }]}>
             <View style={styles.splitHeader}>
                <MaterialCommunityIcons name="bank" size={16} color="#B088FF" />
                <Text style={{ fontSize: 11, fontWeight: '700', marginLeft: 6 }}>My Accounts</Text>
             </View>
             <View style={styles.accountRow}>
                <View style={styles.accIcon}><MaterialCommunityIcons name="credit-card" size={14} color="#666" /></View>
                <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 10, color: '#666' }}>Checking</Text>
                   <Text style={{ fontSize: 11, fontWeight: '700' }}>****4521</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700' }}>$1,240</Text>
             </View>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.title }]}>
            See where your money <Text style={{ color: theme.accent }}>goes</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: Fonts.body }]}>
            Clear insights, accounts, and trends — without the confusion.
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
  splitContent: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  donut: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 6,
      borderColor: '#FF8865',
      marginRight: 12,
  },
  splitLabels: {
      flex: 1,
  },
  splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
  },
  splitDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 4,
  },
  splitText: {
      fontSize: 9,
      color: '#666',
      flex: 1,
  },
  splitValue: {
      fontSize: 9,
      fontWeight: '700',
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
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
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

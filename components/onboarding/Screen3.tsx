import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Screen3() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.visualContainer}>
          <View style={[styles.draftCard, { backgroundColor: theme.card }]}>
             <View style={styles.cardHeader}>
                <View style={styles.headerDots}>
                   <View style={[styles.hDot, { backgroundColor: '#FF5F56' }]} />
                   <View style={[styles.hDot, { backgroundColor: '#FFBD2E' }]} />
                   <View style={[styles.hDot, { backgroundColor: '#27C93F' }]} />
                </View>
                <Text style={[styles.headerTitle, { color: theme.accent }]}>DRAFT ENTRY</Text>
             </View>

             <View style={styles.draftContent}>
                <View style={styles.fieldRow}>
                   <View style={styles.iconBox}>
                      <MaterialCommunityIcons name="store" size={18} color={theme.accent} />
                   </View>
                   <View style={styles.fieldTexts}>
                      <Text style={[styles.fieldLabel, { color: theme.text, opacity: 0.4 }]}>Merchant</Text>
                      <Text style={[styles.fieldValue, { color: theme.text }]}>Grocery Store</Text>
                   </View>
                   <MaterialCommunityIcons name="check-circle" size={18} color="#27C93F" />
                </View>

                <View style={[styles.fieldRow, styles.activeRow, { backgroundColor: theme.accent + '10' }]}>
                   <View style={[styles.iconBox, { backgroundColor: 'white' }]}>
                      <MaterialCommunityIcons name="currency-inr" size={18} color={theme.accent} />
                   </View>
                   <View style={styles.fieldTexts}>
                      <Text style={[styles.fieldLabel, { color: theme.accent }]}>Amount</Text>
                      <Text style={[styles.fieldValue, { color: theme.text }]}>₹820.00?</Text>
                   </View>
                   <View style={[styles.checkBadge, { backgroundColor: '#FF5F56' }]}>
                      <MaterialCommunityIcons name="alert-circle" size={10} color="white" />
                      <Text style={styles.checkText}>Check</Text>
                   </View>
                   <MaterialCommunityIcons name="pencil" size={16} color={theme.accent} style={{ marginLeft: 8 }} />
                </View>

                <View style={styles.fieldRow}>
                   <View style={styles.iconBox}>
                      <MaterialCommunityIcons name="calendar" size={18} color={theme.accent} />
                   </View>
                   <View style={styles.fieldTexts}>
                      <Text style={[styles.fieldLabel, { color: theme.text, opacity: 0.4 }]}>Date</Text>
                      <Text style={[styles.fieldValue, { color: theme.text }]}>Today</Text>
                   </View>
                   <MaterialCommunityIcons name="check-circle" size={18} color="#27C93F" />
                </View>

                <View style={[styles.reviewButton, { backgroundColor: '#F5F5F7' }]}>
                    <Text style={{ color: '#A0A0A0', fontWeight: '600', fontSize: 12 }}>Review to Save</Text>
                </View>
             </View>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.title }]}>
            You&apos;re always in <Text style={{ color: theme.accent }}>control</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: Fonts.body }]}>
            Review, edit, and confirm every entry before it&apos;s saved. Nothing slips through without your okay.
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
  draftCard: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 25,
    elevation: 5,
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
  },
  headerDots: {
      flexDirection: 'row',
      gap: 5,
  },
  hDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
  },
  headerTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
  },
  draftContent: {
      padding: 16,
  },
  fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 16,
      marginBottom: 8,
  },
  activeRow: {
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
  },
  iconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#F8F8F8',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
  },
  fieldTexts: {
      flex: 1,
  },
  fieldLabel: {
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 2,
  },
  fieldValue: {
      fontSize: 13,
      fontWeight: '600',
  },
  checkBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      gap: 3,
  },
  checkText: {
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
  },
  reviewButton: {
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 16,
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

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CardAccount = {
  id: string;
  name: string;
  maskedNumber: string;
  type: string;
  color: string;
  icon: string;
};

type WalletAccount = {
  id: string;
  name: string;
  balance: number;
};

type UPIAccount = {
  id: string;
  name: string;
  handle: string;
};

const cards: CardAccount[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    maskedNumber: '•••• 1234',
    type: 'Credit Card',
    color: '#4338CA',
    icon: 'visa',
  },
  {
    id: 'amex',
    name: 'American Express',
    maskedNumber: '•••• 5678',
    type: 'Platinum Card',
    color: '#1F2937',
    icon: 'alpha-e-circle-outline',
  },
];

const wallets: WalletAccount[] = [
  { id: 'paytm', name: 'PayTM Wallet', balance: 1250.5 },
  { id: 'amazon', name: 'Amazon Pay', balance: 800 },
];

const upiHandles: UPIAccount[] = [
  { id: 'gpay', name: 'Google Pay', handle: 'user@okicici' },
  { id: 'phonepe', name: 'PhonePe', handle: 'user@ybl' },
];

const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
};

export default function AccountsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

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
          <Pressable accessibilityRole="button">
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={theme.text}
            />
          </Pressable>
          <ThemedText style={styles.screenTitle}>Payment Sources</ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardCarousel}>
          {cards.map((card) => (
            <View
              key={card.id}
              style={[
                styles.card,
                {
                  backgroundColor: card.color,
                  elevation: colorScheme === 'light' ? 6 : 0,
                },
              ]}>
              <ThemedText style={styles.cardTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">
                {card.name}
              </ThemedText>
              <ThemedText style={styles.cardNumber} lightColor="#FFFFFF" darkColor="#FFFFFF">
                {card.maskedNumber}
              </ThemedText>
              <View style={styles.cardFooter}>
                <ThemedText style={styles.cardType} lightColor="#FFFFFF99" darkColor="#FFFFFF99">
                  {card.type}
                </ThemedText>
                <MaterialCommunityIcons
                  name={card.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={24}
                  color="#FFFFFFEE"
                />
              </View>
            </View>
          ))}
        </ScrollView>

        <Section
          title="Digital Wallets"
          surfaceColor={surfaceColor}
          borderColor={borderColor}>
          {wallets.map((wallet) => (
            <AccountRow
              key={wallet.id}
              title={wallet.name}
              subtitle={`₹ ${wallet.balance.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}`}
              icon="wallet"
            />
          ))}
        </Section>

        <Section
          title="UPI Handles"
          surfaceColor={surfaceColor}
          borderColor={borderColor}>
          {upiHandles.map((handle) => (
            <AccountRow
              key={handle.id}
              title={handle.name}
              subtitle={handle.handle}
              icon="account-circle-outline"
            />
          ))}
        </Section>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        style={[
          styles.addButton,
          {
            backgroundColor: theme.accent,
            shadowColor: colorScheme === 'light' ? theme.accent : 'transparent',
          },
        ]}>
        <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.addButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
          Add Account
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
  surfaceColor: string;
  borderColor: string;
};

function Section({ title, children, surfaceColor, borderColor }: SectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: surfaceColor, borderColor },
        ]}>
        {children}
      </View>
    </View>
  );
}

type AccountRowProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

function AccountRow({ title, subtitle, icon }: AccountRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <View style={styles.rowAvatar}>
          <MaterialCommunityIcons name={icon} size={24} color="#B0B0B0" />
        </View>
        <View>
          <ThemedText style={styles.rowTitle}>{title}</ThemedText>
          <ThemedText
            style={styles.rowSubtitle}
            lightColor="rgba(26,26,26,0.6)"
            darkColor="rgba(250,250,250,0.6)">
            {subtitle}
          </ThemedText>
        </View>
      </View>
      <MaterialCommunityIcons
        name="dots-vertical"
        size={20}
        color="rgba(26,26,26,0.4)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 96,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  cardCarousel: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    width: 220,
    padding: spacing.lg,
    borderRadius: 24,
    marginRight: spacing.sm,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Fonts.title,
    marginBottom: spacing.sm,
  },
  cardNumber: {
    fontSize: 22,
    fontFamily: Fonts.title,
    letterSpacing: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.title,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(217,217,217,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  rowSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { StateView } from '@/components/ui/StateView';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  accountVisuals,
  formatAccountIdentifier,
  formatCurrency,
  getAccountDisplayAmount,
  getCreditDueLabel,
} from '@/lib/account-display';
import {
  Account,
  type AccountType,
  fetchAccounts,
  normalizeAccountType,
} from '@/lib/accounts';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type AccountFilter = 'all' | AccountType;

type FilterOption = { key: AccountFilter; label: string; sheetLabel: string };

const filterOptions: FilterOption[] = [
  { key: 'all', label: 'All accounts', sheetLabel: 'All accounts' },
  { key: 'cash', label: 'Cash', sheetLabel: 'Cash' },
  { key: 'credit_card', label: 'Credit cards', sheetLabel: 'Credit cards' },
  { key: 'debit_card', label: 'Debit cards', sheetLabel: 'Debit cards' },
  { key: 'bank', label: 'Bank accounts', sheetLabel: 'Bank accounts' },
  { key: 'wallet', label: 'Wallets', sheetLabel: 'Wallets' },
  { key: 'upi', label: 'UPI', sheetLabel: 'UPI' },
  { key: 'other', label: 'Others', sheetLabel: 'Others' },
];

const accountGroups: { key: string; label: string; types: AccountType[] }[] = [
  { key: 'credit_cards', label: 'Credit Cards', types: ['credit_card'] },
  { key: 'bank_accounts', label: 'Bank Accounts', types: ['bank'] },
  { key: 'debit_cards', label: 'Debit Cards', types: ['debit_card'] },
  { key: 'wallets_upi', label: 'Wallets & UPI', types: ['wallet', 'upi'] },
  { key: 'cash', label: 'Cash', types: ['cash'] },
  { key: 'others', label: 'Others', types: ['other'] },
];

const quickAccountOptions: {
  key: AccountType;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    key: 'credit_card',
    label: 'Credit card',
    description: 'Track limits and due dates',
    icon: 'credit-card-outline',
  },
  {
    key: 'bank',
    label: 'Bank account',
    description: 'Separate salary and savings',
    icon: 'bank-outline',
  },
  {
    key: 'upi',
    label: 'UPI',
    description: 'Group daily scan payments',
    icon: 'qrcode-scan',
  },
  {
    key: 'wallet',
    label: 'Wallet',
    description: 'Keep prepaid spends clean',
    icon: 'wallet-outline',
  },
  {
    key: 'cash',
    label: 'Cash',
    description: 'Record offline spending',
    icon: 'cash',
  },
];

type AccountBadge = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  textColor: string;
  bgColor: string;
};

export default function AccountsScreen() {
  const router = useRouter();
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const colorScheme = themeTokens.mode;
  const { token } = useAuthStore();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const surfaceColor = useMemo(() => theme.card, [theme.card]);
  const borderColor = useMemo(() => theme.border, [theme.border]);

  const loadAccounts = useCallback(async () => {
    if (!token) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setAccounts(await fetchAccounts(token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadAccounts();
    }, [loadAccounts])
  );

  const filteredAccounts = useMemo(
    () =>
      activeFilter === 'all'
        ? accounts
        : accounts.filter((account) => normalizeAccountType(account.type) === activeFilter),
    [accounts, activeFilter]
  );

  const groupedAccounts = useMemo(
    () =>
      accountGroups
        .map((group) => ({
          ...group,
          accounts: filteredAccounts.filter((account) =>
            group.types.includes(normalizeAccountType(account.type))
          ),
        }))
        .filter((group) => group.accounts.length > 0),
    [filteredAccounts]
  );

  const filterCounts = useMemo<Record<AccountFilter, number>>(
    () => ({
      all: accounts.length,
      cash: accounts.filter((account) => normalizeAccountType(account.type) === 'cash').length,
      credit_card: accounts.filter((account) => normalizeAccountType(account.type) === 'credit_card')
        .length,
      debit_card: accounts.filter((account) => normalizeAccountType(account.type) === 'debit_card')
        .length,
      bank: accounts.filter((account) => normalizeAccountType(account.type) === 'bank').length,
      wallet: accounts.filter((account) => normalizeAccountType(account.type) === 'wallet').length,
      upi: accounts.filter((account) => normalizeAccountType(account.type) === 'upi').length,
      other: accounts.filter((account) => normalizeAccountType(account.type) === 'other').length,
    }),
    [accounts]
  );

  const activeFilterOption =
    filterOptions.find((option) => option.key === activeFilter) ?? filterOptions[0];

  const accountSummary = useMemo(() => {
    return accounts.reduce(
      (summary, account) => {
        const accountType = normalizeAccountType(account.type);
        const balance = Number(account.balance ?? 0);
        const creditLimit = Number(account.credit_limit ?? 0);
        const hasBalance = Number.isFinite(balance);
        const hasCreditLimit = Number.isFinite(creditLimit);

        if (accountType === 'credit_card') {
          return {
            ...summary,
            creditCards: summary.creditCards + 1,
            creditLimit: summary.creditLimit + (hasCreditLimit ? creditLimit : 0),
            cardsMissingDueDate:
              !account.due_day || account.due_day < 1 || account.due_day > 31
                ? summary.cardsMissingDueDate + 1
                : summary.cardsMissingDueDate,
          };
        }

        return {
          ...summary,
          trackedBalance: summary.trackedBalance + (hasBalance ? balance : 0),
        };
      },
      {
        trackedBalance: 0,
        creditLimit: 0,
        creditCards: 0,
        cardsMissingDueDate: 0,
      }
    );
  }, [accounts]);

  const handleAddAccount = (type?: AccountType) => {
    if (type) {
      router.push({ pathname: '/accounts/manage', params: { type } });
      return;
    }
    router.push('/accounts/manage');
  };

  const handleEditAccount = (account: Account) => {
    router.push({ pathname: '/accounts/[id]', params: { id: String(account.id) } });
  };

  if (isLoading && accounts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView
            icon="wallet-outline"
            title="Loading accounts"
            message="Fetching your payment sources."
            loading
          />
        </View>
      </SafeAreaView>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView
            icon="wifi-off"
            title="Accounts did not load"
            message={error}
            actionLabel="Try again"
            onAction={() => void loadAccounts()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderAccountRow = (account: Account) => {
    const accountType = normalizeAccountType(account.type);
    const visual = accountVisuals[accountType];
    const isCreditCard = accountType === 'credit_card';
    const dueLabel = isCreditCard ? getCreditDueLabel(account.due_day) : null;
    const setupBadges: AccountBadge[] = [];

    if (account.is_default) {
      setupBadges.push({
        label: 'Default',
        icon: 'star',
        textColor: colorScheme === 'light' ? '#7C3AED' : '#DDD6FE',
        bgColor: colorScheme === 'light' ? '#F3E8FF' : '#3B2A52',
      });
    }

    if (isCreditCard && !dueLabel) {
      setupBadges.push({
        label: 'Add due date',
        icon: 'calendar-alert-outline',
        textColor: '#EA580C',
        bgColor: colorScheme === 'light' ? '#FFF7ED' : '#3A2614',
      });
    } else if (dueLabel) {
      setupBadges.push({
        label: dueLabel,
        icon: 'clock-outline',
        textColor: '#64748B',
        bgColor: colorScheme === 'light' ? '#F1F5F9' : '#243142',
      });
    }

    if (!isCreditCard && !account.balance) {
      setupBadges.push({
        label: 'No balance',
        icon: 'scale-balance',
        textColor: '#64748B',
        bgColor: colorScheme === 'light' ? '#F1F5F9' : '#243142',
      });
    }

    if (setupBadges.length === 0) {
      setupBadges.push({
        label: 'Ready',
        icon: 'check-circle-outline',
        textColor: '#15803D',
        bgColor: colorScheme === 'light' ? '#DCFCE7' : '#17351F',
      });
    }

    return (
      <Pressable
        key={String(account.id)}
        accessibilityRole="button"
        accessibilityLabel={`View ${account.name}`}
        onPress={() => handleEditAccount(account)}
        className="min-h-[76px] flex-row items-center rounded-[26px] px-4 py-4"
        style={{
          backgroundColor: surfaceColor,
          shadowColor: '#000000',
          shadowOpacity: colorScheme === 'light' ? 0.06 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        }}>
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: visual.bg }}>
          <MaterialCommunityIcons name={visual.icon} size={23} color={visual.color} />
        </View>

        <View className="min-w-0 flex-1 pr-3">
          <TText
            className="text-base"
            numberOfLines={1}
            style={{ fontFamily: Fonts.title, color: theme.text }}>
            {account.name}
          </TText>
          <TText
            className="mt-1 text-xs"
            numberOfLines={1}
            style={{ fontFamily: Fonts.body }}
            lightColor="rgba(26,26,26,0.52)"
            darkColor="rgba(250,250,250,0.62)">
            {formatAccountIdentifier(account)}
          </TText>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {setupBadges.slice(0, 2).map((badge) => (
              <View
                key={badge.label}
                className="flex-row items-center rounded-full px-2 py-1"
                style={{ backgroundColor: badge.bgColor }}>
                <MaterialCommunityIcons name={badge.icon} size={12} color={badge.textColor} />
                <TText
                  className="ml-1 text-[10px]"
                  numberOfLines={1}
                  style={{ fontFamily: Fonts.title, color: badge.textColor }}>
                  {badge.label}
                </TText>
              </View>
            ))}
          </View>
        </View>

        <View className="items-end">
          <TText
            className="text-base"
            numberOfLines={1}
            style={{ fontFamily: Fonts.title, color: theme.text }}>
            {formatCurrency(getAccountDisplayAmount(account))}
          </TText>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="gap-4 px-[22px] pb-2 pt-[22px]">
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1 gap-2">
              <TText className="text-xl" style={{ fontFamily: Fonts.title }}>
                Accounts
              </TText>
              <TText
                className="text-sm text-black/60 dark:text-white/60"
                style={{ fontFamily: Fonts.body }}>
                Organize payment sources for cleaner transaction tracking.
              </TText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add account"
              onPress={() => handleAddAccount()}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.accent }}>
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 110,
            gap: 22,
          }}>
          {error && (
            <View className="rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
              <TText className="text-center text-sm text-red-600 dark:text-red-300">
                {error}
              </TText>
            </View>
          )}

          {accounts.length === 0 ? (
            <View className="gap-5">
              <StateView
                icon="wallet-outline"
                title="No accounts yet"
                message="Start with the payment source you use most. Finnri will use it to keep new transactions cleaner."
                actionLabel="Add custom account"
                onAction={() => handleAddAccount()}
              />

              <View className="gap-3">
                <TText
                  className="text-xs uppercase"
                  style={{ fontFamily: Fonts.title, color: '#64748B', letterSpacing: 0.8 }}>
                  Quick start
                </TText>
                <View className="gap-3">
                  {quickAccountOptions.map((option) => {
                    const visual = accountVisuals[option.key];
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${option.label}`}
                        onPress={() => handleAddAccount(option.key)}
                        className="min-h-[74px] flex-row items-center rounded-[24px] border px-4 py-4"
                        style={{ backgroundColor: surfaceColor, borderColor }}>
                        <View
                          className="mr-4 h-11 w-11 items-center justify-center rounded-full"
                          style={{ backgroundColor: visual.bg }}>
                          <MaterialCommunityIcons
                            name={option.icon}
                            size={22}
                            color={visual.color}
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <TText
                            className="text-sm"
                            numberOfLines={1}
                            style={{ fontFamily: Fonts.title, color: theme.text }}>
                            {option.label}
                          </TText>
                          <TText
                            className="mt-1 text-xs"
                            numberOfLines={1}
                            style={{ fontFamily: Fonts.body, color: '#64748B' }}>
                            {option.description}
                          </TText>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <>
              <View className="flex-row gap-3">
                <View
                  className="min-h-[96px] flex-1 rounded-[24px] border px-4 py-4"
                  style={{ backgroundColor: surfaceColor, borderColor }}>
                  <MaterialCommunityIcons name="scale-balance" size={20} color={theme.accent} />
                  <TText
                    className="mt-3 text-[11px] uppercase"
                    style={{ fontFamily: Fonts.title, color: '#64748B', letterSpacing: 0.6 }}>
                    Manual balance
                  </TText>
                  <TText
                    className="mt-1 text-lg"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontFamily: Fonts.title, color: theme.text }}>
                    {formatCurrency(accountSummary.trackedBalance)}
                  </TText>
                </View>
                <View
                  className="min-h-[96px] flex-1 rounded-[24px] border px-4 py-4"
                  style={{ backgroundColor: surfaceColor, borderColor }}>
                  <MaterialCommunityIcons
                    name="credit-card-clock-outline"
                    size={20}
                    color="#A855F7"
                  />
                  <TText
                    className="mt-3 text-[11px] uppercase"
                    style={{ fontFamily: Fonts.title, color: '#64748B', letterSpacing: 0.6 }}>
                    Credit limit
                  </TText>
                  <TText
                    className="mt-1 text-lg"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontFamily: Fonts.title, color: theme.text }}>
                    {formatCurrency(accountSummary.creditLimit)}
                  </TText>
                </View>
              </View>

              {accountSummary.cardsMissingDueDate > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveFilter('credit_card')}
                  className="flex-row items-center rounded-[22px] border px-4 py-3"
                  style={{ backgroundColor: colorScheme === 'light' ? '#FFF7ED' : '#2A2118', borderColor: '#FDBA74' }}>
                  <MaterialCommunityIcons name="calendar-alert-outline" size={20} color="#F97316" />
                  <TText
                    className="ml-3 flex-1 text-sm"
                    style={{ fontFamily: Fonts.body, color: colorScheme === 'light' ? '#9A3412' : '#FDBA74' }}>
                    Add due dates to {accountSummary.cardsMissingDueDate} credit card
                    {accountSummary.cardsMissingDueDate > 1 ? 's' : ''} for better reminders.
                  </TText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#F97316" />
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter accounts"
                onPress={() => setIsFilterSheetVisible(true)}
                className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
                style={{ backgroundColor: surfaceColor, borderColor }}>
                <View className="min-w-0 flex-1">
                  <TText
                    className="text-[11px] uppercase"
                    style={{ fontFamily: Fonts.title, color: '#64748B', letterSpacing: 0.6 }}>
                    Account type
                  </TText>
                  <TText
                    className="mt-1 text-sm"
                    numberOfLines={1}
                    style={{ fontFamily: Fonts.title, color: theme.text }}>
                    {activeFilterOption.label}
                  </TText>
                </View>
                <View className="ml-4 flex-row items-center gap-2">
                  <TText
                    className="text-xs"
                    style={{ fontFamily: Fonts.body, color: '#64748B' }}>
                    {filterCounts[activeFilter]}
                  </TText>
                  <MaterialCommunityIcons name="chevron-down" size={22} color="#64748B" />
                </View>
              </Pressable>

              {groupedAccounts.map((group) => (
                <View key={group.key} className="gap-3">
                  <TText
                    className="text-xs uppercase"
                    style={{
                      fontFamily: Fonts.title,
                      color: '#64748B',
                      letterSpacing: 0.8,
                    }}>
                    {group.label}
                  </TText>
                  <View className="gap-3">{group.accounts.map(renderAccountRow)}</View>
                </View>
              ))}

              {filteredAccounts.length === 0 && (
                <StateView
                  icon="filter-off-outline"
                  title="No accounts match"
                  message="Clear this filter to see the rest of your accounts."
                  actionLabel="Show all accounts"
                  onAction={() => setActiveFilter('all')}
                  compact
                />
              )}
            </>
          )}
        </ScrollView>

        <AnimatedBottomSheet
          visible={isFilterSheetVisible}
          onClose={() => setIsFilterSheetVisible(false)}
          sheetStyle={{
            backgroundColor: surfaceColor,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: 34,
          }}>
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <TText className="text-lg" style={{ fontFamily: Fonts.title, color: theme.text }}>
                Filter accounts
              </TText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter"
                onPress={() => setIsFilterSheetVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.secondary }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View className="gap-2">
              {filterOptions.map((option) => {
                const isActive = option.key === activeFilter;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      setActiveFilter(option.key);
                      setIsFilterSheetVisible(false);
                    }}
                    className="flex-row items-center justify-between rounded-2xl border px-4 py-4"
                    style={{
                      borderColor: isActive ? theme.accent : borderColor,
                      backgroundColor: isActive ? theme.secondary : 'transparent',
                    }}>
                    <TText
                      className="text-sm"
                      style={{ fontFamily: Fonts.title, color: theme.text }}>
                      {option.sheetLabel}
                    </TText>
                    <View className="flex-row items-center gap-3">
                      <TText
                        className="text-xs"
                        style={{ fontFamily: Fonts.body, color: '#64748B' }}>
                        {filterCounts[option.key]}
                      </TText>
                      {isActive && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={theme.accent}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </AnimatedBottomSheet>
      </TView>
    </SafeAreaView>
  );
}

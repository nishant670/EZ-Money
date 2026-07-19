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

  const handleAddAccount = () => {
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
    const statusLabel =
      (isCreditCard && getCreditDueLabel(account.due_day)) ||
      (account.is_default ? 'Default' : null);

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
        </View>

        <View className="items-end">
          <TText
            className="text-base"
            numberOfLines={1}
            style={{ fontFamily: Fonts.title, color: theme.text }}>
            {formatCurrency(getAccountDisplayAmount(account))}
          </TText>
          {statusLabel && (
            <TText
              className="mt-1 text-xs"
              numberOfLines={1}
              style={{
                fontFamily: Fonts.body,
                color:
                  statusLabel === 'Default'
                    ? colorScheme === 'light'
                      ? '#64748B'
                      : '#CBD5E1'
                    : '#64748B',
              }}>
              {statusLabel}
            </TText>
          )}
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
              onPress={handleAddAccount}
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
            <StateView
              icon="wallet-outline"
              title="No accounts yet"
              message="Add a cash, bank, card, wallet, or UPI source so every transaction has the right account."
              actionLabel="Add account"
              onAction={handleAddAccount}
            />
          ) : (
            <>
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

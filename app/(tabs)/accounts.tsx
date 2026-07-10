import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StateView } from '@/components/ui/StateView';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Account,
  AccountApiError,
  deleteAccount,
  fetchAccounts,
  toAccountPayload,
  updateAccount,
} from '@/lib/accounts';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type AccountType = 'cash' | 'credit' | 'debit' | 'bank' | 'wallet' | 'upi' | 'other';
type AccountFilter = 'all' | AccountType;

const filterOptions: { key: AccountFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cash', label: 'Cash' },
  { key: 'credit', label: 'Credit Cards' },
  { key: 'debit', label: 'Debit Cards' },
  { key: 'bank', label: 'Bank Accounts' },
  { key: 'wallet', label: 'Wallets' },
  { key: 'upi', label: 'UPI' },
  { key: 'other', label: 'Other' },
];

export default function AccountsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuthStore();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState<number | null>(null);
  const surfaceColor = useMemo(
    () => (colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E'),
    [colorScheme]
  );
  const borderColor = useMemo(
    () => (colorScheme === 'light' ? theme.border : '#2E2E2E'),
    [colorScheme, theme.border]
  );

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
        : accounts.filter((account) => account.type === activeFilter),
    [accounts, activeFilter]
  );

  const handleAddAccount = () => {
    router.push('/accounts/manage');
  };

  const handleEditAccount = (account: Account) => {
    router.push({ pathname: '/accounts/manage', params: { id: String(account.id) } });
  };

  const handleSetDefault = async (account: Account) => {
    if (!token || account.is_default) return;
    setPendingAccountId(account.id);
    setError(null);
    try {
      await updateAccount(token, account.id, toAccountPayload({ ...account, is_default: true }));
      await loadAccounts();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Unable to set the default account.'
      );
    } finally {
      setPendingAccountId(null);
    }
  };

  const confirmDeleteAccount = (account: Account) => {
    Alert.alert(
      `Delete ${account.name}?`,
      'This is allowed only when no transactions use this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!token) return;
            setPendingAccountId(account.id);
            setError(null);
            void deleteAccount(token, account.id)
              .then(loadAccounts)
              .catch((deleteError: unknown) => {
                if (
                  deleteError instanceof AccountApiError &&
                  deleteError.code === 'account_in_use'
                ) {
                  setError('Move or delete linked transactions before deleting this account.');
                  return;
                }
                setError(
                  deleteError instanceof Error ? deleteError.message : 'Unable to delete account.'
                );
              })
              .finally(() => setPendingAccountId(null));
          },
        },
      ]
    );
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

  if (accounts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView
            icon="wallet-outline"
            title="No accounts yet"
            message="Add a cash, bank, card, wallet, or UPI source so every transaction has the right account."
            actionLabel="Add account"
            onAction={handleAddAccount}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderAccountRow = (account: Account) => {
    const iconName: Record<AccountType, keyof typeof MaterialCommunityIcons.glyphMap> = {
      cash: 'cash',
      credit: 'credit-card-outline',
      debit: 'credit-card-outline',
      bank: 'bank-outline',
      wallet: 'wallet-outline',
      upi: 'cellphone-nfc',
      other: 'wallet-outline',
    };
    const accountType = account.type in iconName ? (account.type as AccountType) : 'other';
    const accountDetails =
      [account.provider, account.identifier].filter(Boolean).join(' • ') ||
      accountType.replace('_', ' ');

    return (
      <View
        key={String(account.id)}
        className="gap-2 rounded-2xl border px-4 py-4"
        style={{ backgroundColor: surfaceColor, borderColor }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: colorScheme === 'light' ? '#EEF2FF' : '#2B2B2B' }}>
              <MaterialCommunityIcons name={iconName[accountType]} size={20} color={theme.text} />
            </View>
            <View>
              <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                {account.name}
              </TText>
              <TText
                className="text-xs"
                style={{ fontFamily: Fonts.body }}
                lightColor="rgba(26,26,26,0.6)"
                darkColor="rgba(250,250,250,0.65)">
                {accountDetails}
              </TText>
            </View>
          </View>
          {account.is_default && (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: colorScheme === 'light' ? '#E8F5E9' : '#1F3322' }}>
              <TText className="text-xs" style={{ fontFamily: Fonts.title, color: '#27AE60' }}>
                Default
              </TText>
            </View>
          )}
        </View>
        <View
          className="flex-row items-center justify-end gap-2 border-t pt-3"
          style={{ borderColor }}>
          {pendingAccountId === account.id ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <>
              {!account.is_default && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleSetDefault(account)}
                  className="rounded-xl px-3 py-2">
                  <TText
                    className="text-xs"
                    style={{ color: theme.accent, fontFamily: Fonts.title }}>
                    Set default
                  </TText>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => handleEditAccount(account)}
                className="rounded-xl px-3 py-2">
                <TText className="text-xs" style={{ color: theme.text, fontFamily: Fonts.title }}>
                  Edit
                </TText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDeleteAccount(account)}
                className="rounded-xl px-3 py-2">
                <TText className="text-xs text-red-500" style={{ fontFamily: Fonts.title }}>
                  Delete
                </TText>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 22, gap: 20 }}>
          <View className="gap-2">
            <TText className="text-xl" style={{ fontFamily: Fonts.title }}>
              Accounts
            </TText>
            <TText
              className="text-sm text-black/60 dark:text-white/60"
              style={{ fontFamily: Fonts.body }}>
              Organize the cards, bank accounts, wallets, and UPI sources you use for transactions.
            </TText>
          </View>

          {error && (
            <View className="rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
              <TText className="text-center text-sm text-red-600 dark:text-red-300">{error}</TText>
            </View>
          )}

          <View className="flex-row flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = option.key === activeFilter;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  onPress={() => setActiveFilter(option.key)}
                  className="rounded-2xl px-4 py-2"
                  style={{
                    backgroundColor: isActive ? theme.accent : 'transparent',
                    borderColor: isActive ? 'transparent' : borderColor,
                    borderWidth: 1,
                  }}>
                  <TText
                    className="text-xs"
                    style={{
                      fontFamily: Fonts.title,
                      color: isActive ? '#FFFFFF' : theme.text,
                    }}>
                    {option.label}
                  </TText>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">{filteredAccounts.map(renderAccountRow)}</View>

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

          <Pressable
            accessibilityRole="button"
            onPress={handleAddAccount}
            className="rounded-3xl border py-3"
            style={{ borderColor }}>
            <TText className="text-center text-sm" style={{ fontFamily: Fonts.title }}>
              Add another account
            </TText>
          </Pressable>
        </ScrollView>
      </TView>
    </SafeAreaView>
  );
}

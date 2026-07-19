import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
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
  AccountApiError,
  deleteAccount,
  fetchAccounts,
  normalizeAccountType,
  toAccountPayload,
  updateAccount,
} from '@/lib/accounts';
import { loadTransactions } from '@/lib/transactions';
import { Transaction } from '@/types/transaction';

const TText = cssInterop(ThemedText, { className: 'style' });

const formatActivityAmount = (transaction: Transaction) => {
  const isIncome = transaction.entryType === 'income' || transaction.amount >= 0;
  return `${isIncome ? '+ ' : '- '}${formatCurrency(Math.abs(transaction.amount))}`;
};

export default function AccountDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accountId = Number(id);
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const colorScheme = themeTokens.mode;
  const { token } = useAuthStore();

  const [account, setAccount] = useState<Account | null>(null);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!token || !Number.isFinite(accountId) || accountId <= 0) {
      setIsLoading(false);
      setError('Account not found.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [accounts, transactions] = await Promise.all([
        fetchAccounts(token),
        loadTransactions(token, { account_id: accountId, page: 1, page_size: 5 }),
      ]);
      const matchedAccount = accounts.find((candidate) => candidate.id === accountId);
      if (!matchedAccount) {
        throw new Error('Account not found.');
      }
      setAccount(matchedAccount);
      setActivity(transactions.slice(0, 5));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load account.');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, token]);

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
    }, [loadDetails])
  );

  const visual = useMemo(() => {
    const type = account ? normalizeAccountType(account.type) : 'other';
    return accountVisuals[type];
  }, [account]);

  const accountType = account ? normalizeAccountType(account.type) : 'other';
  const isCreditCard = accountType === 'credit_card';
  const dueLabel = account ? getCreditDueLabel(account.due_day) : null;
  const amountLabel = isCreditCard ? 'Total Due' : 'Balance';

  const handleEdit = () => {
    if (!account) return;
    router.push({ pathname: '/accounts/manage', params: { id: String(account.id) } });
  };

  const handleSetDefault = async () => {
    if (!token || !account || account.is_default) return;
    setIsPending(true);
    setError(null);
    try {
      await updateAccount(token, account.id, toAccountPayload({ ...account, is_default: true }));
      await loadDetails();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update account.');
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = () => {
    if (!token || !account) return;
    Alert.alert(
      `Delete ${account.name}?`,
      'This is allowed only when no transactions use this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsPending(true);
            setError(null);
            void deleteAccount(token, account.id)
              .then(() => router.back())
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
              .finally(() => setIsPending(false));
          },
        },
      ]
    );
  };

  const openSettings = () => {
    if (!account) return;
    Alert.alert(account.name, 'Account actions', [
      ...(!account.is_default
        ? [{ text: 'Set as default', onPress: () => void handleSetDefault() }]
        : []),
      { text: 'Edit account', onPress: handleEdit },
      { text: 'Delete account', style: 'destructive' as const, onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const openPayNow = () => {
    Alert.alert('Pay Now', 'Payment reminders are not connected yet.');
  };

  const openAllTransactions = () => {
    if (!account) return;
    router.push({ pathname: '/transactions', params: { accountId: String(account.id) } });
  };

  const renderActivityItem = (transaction: Transaction) => {
    const isIncome = transaction.entryType === 'income' || transaction.amount >= 0;

    return (
      <Pressable
        key={transaction.id}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/entry/[id]',
            params: {
              id: transaction.id,
              name: transaction.name,
              category: transaction.category,
              amount: String(Math.abs(transaction.amount)),
              entryType: transaction.entryType ?? 'expense',
              section: transaction.section,
              mode: transaction.mode ?? '',
              notes: transaction.notes ?? '',
              merchant: transaction.merchant ?? '',
              dateLabel: transaction.dateLabel ?? '',
              rawDate: transaction.rawDate ?? '',
              tag: transaction.tag ?? '',
            },
          })
        }
        className="min-h-[88px] flex-row items-center rounded-[24px] px-4 py-4"
        style={{
          backgroundColor: theme.card,
          shadowColor: '#000000',
          shadowOpacity: colorScheme === 'light' ? 0.04 : 0,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 1,
        }}>
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: transaction.bgColor ?? '#F1F5F9' }}>
          <MaterialCommunityIcons
            name={transaction.icon}
            size={22}
            color={transaction.color ?? '#64748B'}
          />
        </View>
        <View className="min-w-0 flex-1 pr-3">
          <TText
            className="text-base"
            numberOfLines={1}
            style={{ fontFamily: Fonts.title, color: theme.text }}>
            {transaction.name}
          </TText>
          <TText
            className="mt-1 text-xs"
            numberOfLines={1}
            style={{ fontFamily: Fonts.body, color: '#7C8EA8' }}>
            {transaction.category} • {transaction.section}
          </TText>
        </View>
        <TText
          className="text-sm"
          numberOfLines={1}
          style={{
            fontFamily: Fonts.title,
            color: isIncome ? '#16A34A' : theme.text,
          }}>
          {formatActivityAmount(transaction)}
        </TText>
      </Pressable>
    );
  };

  if (isLoading && !account) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView
            icon="wallet-outline"
            title="Loading account"
            message="Fetching account details."
            loading
          />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !account) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView
            icon="wifi-off"
            title="Account did not load"
            message={error}
            actionLabel="Try again"
            onAction={() => void loadDetails()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!account) return null;

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="flex-row items-center justify-between px-6 pb-4 pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.card }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
          </Pressable>
          <TText
            className="text-sm uppercase"
            style={{ fontFamily: Fonts.title, color: theme.text, letterSpacing: 1.2 }}>
            Account Details
          </TText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account actions"
            onPress={openSettings}
            className="h-11 w-11 items-center justify-center rounded-full">
            {isPending ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <MaterialCommunityIcons name="dots-horizontal" size={24} color="#8EA0B8" />
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 110 }}>
          {error && (
            <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
              <TText className="text-center text-sm text-red-600 dark:text-red-300">{error}</TText>
            </View>
          )}

          <View
            className="items-center rounded-[34px] px-5 py-9"
            style={{
              backgroundColor: colorScheme === 'light' ? '#F0E3FF' : '#2B2335',
              shadowColor: '#A855F7',
              shadowOpacity: colorScheme === 'light' ? 0.12 : 0,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 16 },
            }}>
            <View
              className="h-[68px] w-[68px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.card }}>
              <MaterialCommunityIcons name={visual.icon} size={30} color={visual.color} />
            </View>

            <TText
              className="mt-5 text-2xl"
              numberOfLines={1}
              style={{ fontFamily: Fonts.title, color: theme.text }}>
              {account.name}
            </TText>
            <TText
              className="mt-2 text-sm"
              numberOfLines={1}
              style={{ fontFamily: Fonts.body, color: '#7C8EA8' }}>
              {formatAccountIdentifier(account)}
            </TText>

            <TText
              className="mt-6 text-xs uppercase"
              style={{ fontFamily: Fonts.title, color: '#8EA0B8', letterSpacing: 1.4 }}>
              {amountLabel}
            </TText>
            <TText
              className="mt-1 text-[38px]"
              numberOfLines={1}
              style={{ fontFamily: Fonts.title, color: theme.text }}>
              {formatCurrency(getAccountDisplayAmount(account))}
            </TText>

            {isCreditCard && dueLabel && (
              <View className="mt-6 flex-row items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3">
                <MaterialCommunityIcons name="clock-outline" size={16} color="#F43F5E" />
                <TText className="text-sm" style={{ fontFamily: Fonts.title, color: '#F43F5E' }}>
                  {dueLabel}
                </TText>
              </View>
            )}
          </View>

          <View className="mt-7 flex-row gap-3">
            <DetailActionButton
              icon="cash"
              label="Pay Now"
              active
              onPress={openPayNow}
              textColor="#FFFFFF"
              backgroundColor="#0F172A"
            />
            <DetailActionButton
              icon="pencil-outline"
              label="Edit"
              onPress={handleEdit}
              textColor={theme.text}
              backgroundColor={theme.card}
              borderColor={theme.border}
            />
            <DetailActionButton
              icon="cog-outline"
              label="Settings"
              onPress={openSettings}
              textColor={theme.text}
              backgroundColor={theme.card}
              borderColor={theme.border}
            />
          </View>

          <View className="mt-9 flex-row items-center justify-between">
            <TText className="text-xl" style={{ fontFamily: Fonts.title, color: theme.text }}>
              Recent Activity
            </TText>
            <Pressable accessibilityRole="button" onPress={openAllTransactions}>
              <TText className="text-sm" style={{ fontFamily: Fonts.title, color: theme.accent }}>
                See All
              </TText>
            </Pressable>
          </View>

          <View className="mt-5 gap-3">
            {activity.length > 0 ? (
              activity.map(renderActivityItem)
            ) : (
              <View className="rounded-[24px] bg-white px-5 py-8 dark:bg-neutral-900">
                <StateView
                  icon="receipt-text-plus-outline"
                  title="No recent activity"
                  message="Transactions linked to this account will show here."
                  compact
                />
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

type DetailActionButtonProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  textColor: string;
  backgroundColor: string;
  borderColor?: string;
  active?: boolean;
};

function DetailActionButton({
  icon,
  label,
  onPress,
  textColor,
  backgroundColor,
  borderColor,
  active = false,
}: DetailActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-[80px] flex-1 items-center justify-center rounded-[22px] border"
      style={{
        backgroundColor,
        borderColor: borderColor ?? backgroundColor,
        shadowColor: '#000000',
        shadowOpacity: active ? 0.18 : 0,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: active ? 3 : 0,
      }}>
      <MaterialCommunityIcons name={icon} size={24} color={textColor} />
      <TText className="mt-2 text-sm" numberOfLines={1} style={{ fontFamily: Fonts.title, color: textColor }}>
        {label}
      </TText>
    </Pressable>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountDetailSkeleton } from '@/components/accounts/AccountSkeletons';
import { CreditUsageBar } from '@/components/accounts/CreditUsageBar';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { StateView } from '@/components/ui/StateView';
import { ThemedDeleteDialog } from '@/components/ui/ThemedConfirmDialog';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  accountVisuals,
  formatAccountIdentifier,
  getAccountHeadline,
  getCreditDueLabel,
  getCreditUsage,
  getLastActivityLabel,
  getRunningBalance,
} from '@/lib/account-display';
import { formatMoney } from '@/lib/money';
import {
  Account,
  AccountApiError,
  deleteAccount,
  fetchAccounts,
  normalizeAccountType,
  toAccountPayload,
  updateAccount,
} from '@/lib/accounts';
import { getFriendlyErrorMessage } from '@/lib/api-error';
import { loadTransactions } from '@/lib/transactions';
import { Transaction } from '@/types/transaction';

const TText = cssInterop(ThemedText, { className: 'style' });

/**
 * Back, the screen's name, and the actions menu.
 *
 * Shared with the loading frame, where `onActions` is omitted: the menu acts on
 * an account that has not arrived, and a button that does nothing is worse than
 * a gap. The gap is still 44pt wide so the title stays where it will be.
 */
function DetailHeader({
  onBack,
  onActions,
  pending = false,
}: {
  onBack: () => void;
  onActions?: () => void;
  pending?: boolean;
}) {
  const theme = useThemeTokens().colors;

  return (
    <View className="flex-row items-center justify-between px-6 pb-4 pt-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.card }}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
      </Pressable>
      <TText
        className="text-sm uppercase"
        style={{ fontFamily: Fonts.title, color: theme.text, letterSpacing: 1.2 }}>
        Account Details
      </TText>
      {onActions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account actions"
          onPress={onActions}
          className="h-11 w-11 items-center justify-center rounded-full">
          {pending ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <MaterialCommunityIcons name="dots-horizontal" size={24} color="#8EA0B8" />
          )}
        </Pressable>
      ) : (
        <View className="h-11 w-11" />
      )}
    </View>
  );
}

const formatActivityAmount = (transaction: Transaction) => {
  const isIncome = transaction.entryType === 'income' || transaction.amount >= 0;
  return `${isIncome ? '+ ' : '- '}${formatMoney(Math.abs(transaction.amount))}`;
};

type SetupItem = {
  label: string;
  complete: boolean;
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
  const [isActionsSheetVisible, setIsActionsSheetVisible] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);

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
      setError(getFriendlyErrorMessage(loadError, 'Unable to load account.'));
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
  // The hero was labelled "Balance"/"Total Due" over a number that was neither:
  // a stale manual figure, or on a card the credit limit itself.
  const headline = account ? getAccountHeadline(account) : null;
  const creditUsage = account ? getCreditUsage(account) : null;
  const runningBalance = account ? getRunningBalance(account) : null;
  const lastActivity = account ? getLastActivityLabel(account) : null;
  const setupItems = useMemo<SetupItem[]>(() => {
    if (!account) return [];
    const hasProvider = Boolean(account.provider?.trim());
    const hasIdentifier = Boolean(account.identifier?.trim());
    const hasBalance = typeof account.balance === 'number' && account.balance !== 0;
    const hasCreditLimit = Boolean(account.credit_limit && account.credit_limit > 0);
    const hasDueDay = Boolean(account.due_day && account.due_day >= 1 && account.due_day <= 31);

    if (isCreditCard) {
      return [
        { label: 'Card issuer added', complete: hasProvider },
        { label: 'Last 4 digits added', complete: hasIdentifier },
        { label: 'Credit limit added', complete: hasCreditLimit },
        { label: 'Due date added', complete: hasDueDay },
      ];
    }

    if (accountType === 'cash') {
      return [{ label: 'Opening cash balance added', complete: hasBalance }];
    }

    // "Manual balance" described a number that sat there; "opening balance" is
    // what it actually is now that the ledger runs a balance forward from it.

    const providerLabel =
      accountType === 'upi' ? 'UPI app added' : accountType === 'wallet' ? 'Wallet added' : 'Provider added';
    const identifierLabel =
      accountType === 'upi'
        ? 'UPI handle or nickname added'
        : accountType === 'wallet'
          ? 'Wallet nickname added'
          : 'Last 4 digits added';

    return [
      { label: providerLabel, complete: hasProvider },
      { label: identifierLabel, complete: hasIdentifier },
      { label: 'Opening balance added', complete: hasBalance },
    ];
  }, [account, accountType, isCreditCard]);
  const incompleteSetupItems = setupItems.filter((item) => !item.complete);
  const setupComplete = incompleteSetupItems.length === 0;

  const handleEdit = (focus?: 'details') => {
    if (!account) return;
    router.push({
      pathname: '/accounts/manage',
      params: { id: String(account.id), ...(focus ? { focus } : {}) },
    });
  };

  const handleSetDefault = async () => {
    if (!token || !account || account.is_default) return;
    setIsPending(true);
    setError(null);
    try {
      await updateAccount(token, account.id, toAccountPayload({ ...account, is_default: true }));
      await loadDetails();
    } catch (updateError) {
      setError(getFriendlyErrorMessage(updateError, 'Unable to update account.'));
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = () => {
    if (!token || !account) return;
    setIsPending(true);
    setError(null);
    void deleteAccount(token, account.id)
      .then(() => {
        setIsDeleteDialogVisible(false);
        router.back();
      })
      .catch((deleteError: unknown) => {
        if (
          deleteError instanceof AccountApiError &&
          deleteError.code === 'account_in_use'
        ) {
          setError('Move or delete linked transactions before deleting this account.');
          return;
        }
        setError(getFriendlyErrorMessage(deleteError, 'Unable to delete account.'));
      })
      .finally(() => setIsPending(false));
  };

  const openSettings = () => {
    if (!account) return;
    setIsActionsSheetVisible(true);
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

  // Back and the title are known before the account is, so they are drawn for
  // real. Only the parts that depend on which account this turns out to be are
  // placeholders — a header that shimmers is a header claiming to be loading.
  if (isLoading && !account) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background }}
        edges={['top', 'left', 'right']}>
        <DetailHeader onBack={() => router.back()} />
        <AccountDetailSkeleton />
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
        <DetailHeader onBack={() => router.back()} onActions={openSettings} pending={isPending} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 110 }}>
          {error && <ErrorBanner message={error} style={{ marginBottom: 16 }} />}

          {/* Standard card surface. The one-off lavender was the only place in
              the app using that colour, and it made a screen full of derived
              figures look like a promotional panel. */}
          <View
            className="items-center rounded-[34px] border px-5 py-9"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: '#000000',
              shadowOpacity: colorScheme === 'light' ? 0.06 : 0,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 16 },
            }}>
            <View
              className="h-[68px] w-[68px] items-center justify-center rounded-full"
              style={{ backgroundColor: visual.bg }}>
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
              {headline?.label}
            </TText>
            <TText
              className="mt-2 text-[38px]"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: Fonts.title, color: theme.text, lineHeight: 48 }}>
              {headline?.placeholder ?? formatMoney(headline?.amount ?? 0)}
            </TText>

            <TText
              className="mt-2 text-xs"
              numberOfLines={1}
              style={{ fontFamily: Fonts.body, color: '#8EA0B8' }}>
              {lastActivity ? `Last activity ${lastActivity}` : 'No transactions yet'}
            </TText>

            {creditUsage && (
              <View className="w-full px-2">
                <CreditUsageBar usage={creditUsage} trackColor={theme.secondary} />
              </View>
            )}

            {isCreditCard && dueLabel && (
              <View className="mt-6 flex-row items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3">
                <MaterialCommunityIcons name="clock-outline" size={16} color="#F43F5E" />
                <TText className="text-sm" style={{ fontFamily: Fonts.title, color: '#F43F5E' }}>
                  {dueLabel}
                </TText>
              </View>
            )}
          </View>

          {account.summary && <AccountFigures account={account} runningBalance={runningBalance} />}

          <View className="mt-7 flex-row gap-3">
            <DetailActionButton
              icon={setupComplete ? 'receipt-text-outline' : 'clipboard-check-outline'}
              label={setupComplete ? 'Activity' : 'Complete'}
              active
              onPress={setupComplete ? openAllTransactions : () => handleEdit('details')}
              textColor="#FFFFFF"
              backgroundColor={setupComplete ? theme.accent : '#0F172A'}
            />
            <DetailActionButton
              icon="pencil-outline"
              label="Edit"
              onPress={() => handleEdit()}
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

          <View
            className="mt-7 rounded-[26px] border px-5 py-5"
            style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
                <TText
                  className="text-base"
                  style={{ fontFamily: Fonts.title, color: theme.text }}>
                  {setupComplete ? 'Setup complete' : 'Complete setup'}
                </TText>
                <TText
                  className="mt-1 text-sm"
                  style={{ fontFamily: Fonts.body, color: '#7C8EA8' }}>
                  {setupComplete
                    ? 'This account has the key details Finnri needs for cleaner tracking.'
                    : `${incompleteSetupItems.length} detail${incompleteSetupItems.length > 1 ? 's' : ''} missing for better tracking.`}
                </TText>
              </View>
              {!setupComplete && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleEdit('details')}
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: theme.accent }}>
                  <TText
                    className="text-xs"
                    style={{ fontFamily: Fonts.title, color: '#FFFFFF' }}>
                    Update
                  </TText>
                </Pressable>
              )}
            </View>

            <View className="mt-4 gap-3">
              {setupItems.map((item) => (
                <View key={item.label} className="flex-row items-center gap-3">
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: item.complete
                        ? colorScheme === 'light'
                          ? '#DCFCE7'
                          : '#17351F'
                        : colorScheme === 'light'
                          ? '#F1F5F9'
                          : '#243142',
                    }}>
                    <MaterialCommunityIcons
                      name={item.complete ? 'check' : 'minus'}
                      size={16}
                      color={item.complete ? '#15803D' : '#64748B'}
                    />
                  </View>
                  <TText
                    className="flex-1 text-sm"
                    style={{ fontFamily: Fonts.body, color: item.complete ? theme.text : '#64748B' }}>
                    {item.label}
                  </TText>
                </View>
              ))}
            </View>
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

        <AnimatedBottomSheet
          visible={isActionsSheetVisible}
          onClose={() => setIsActionsSheetVisible(false)}
          sheetStyle={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: 34,
          }}>
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1 pr-3">
                <TText className="text-lg" style={{ fontFamily: Fonts.title, color: theme.text }}>
                  {account.name}
                </TText>
                <TText className="mt-1 text-xs" style={{ fontFamily: Fonts.body, color: '#7C8EA8' }}>
                  Account actions
                </TText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close account actions"
                onPress={() => setIsActionsSheetVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.secondary }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View className="gap-2">
              {!account.is_default && (
                <AccountActionRow
                  icon="star-outline"
                  label="Set as default"
                  description="Use this account first for matching transactions."
                  color={theme.accent}
                  backgroundColor={theme.secondary}
                  textColor={theme.text}
                  mutedColor="#7C8EA8"
                  onPress={() => {
                    setIsActionsSheetVisible(false);
                    void handleSetDefault();
                  }}
                />
              )}
              <AccountActionRow
                icon="pencil-outline"
                label="Edit account"
                description="Update type, name, balance, or reminders."
                color={theme.accent}
                backgroundColor={theme.secondary}
                textColor={theme.text}
                mutedColor="#7C8EA8"
                onPress={() => {
                  setIsActionsSheetVisible(false);
                  handleEdit();
                }}
              />
              <AccountActionRow
                icon="delete-outline"
                label="Delete account"
                description="Allowed only when no transactions use this account."
                color="#EF4444"
                backgroundColor={colorScheme === 'light' ? '#FEF2F2' : '#3A2020'}
                textColor={theme.text}
                mutedColor="#7C8EA8"
                onPress={() => {
                  setIsActionsSheetVisible(false);
                  setIsDeleteDialogVisible(true);
                }}
              />
            </View>
          </View>
        </AnimatedBottomSheet>

        <ThemedDeleteDialog
          visible={isDeleteDialogVisible}
          title={`Delete ${account.name}?`}
          message="This is allowed only when no transactions use this account."
          confirmLabel="Delete"
          loading={isPending}
          onCancel={() => setIsDeleteDialogVisible(false)}
          onConfirm={handleDelete}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * The figures behind the hero, so the headline can be checked rather than
 * believed — and so the opening balance the user typed is still visible, now
 * labelled as the starting point it actually is.
 */
function AccountFigures({
  account,
  runningBalance,
}: {
  account: Account;
  runningBalance: number | null;
}) {
  const theme = useThemeTokens().colors;
  const summary = account.summary;
  if (!summary) return null;

  const isCreditCard = normalizeAccountType(account.type) === 'credit_card';
  const opening = account.balance ?? 0;

  const rows: { label: string; value: string; muted?: boolean }[] = [
    {
      label: 'Spent this month',
      value: formatMoney(summary.spent_this_month),
    },
  ];

  if (summary.received_this_month > 0) {
    rows.push({
      label: isCreditCard ? 'Paid off this month' : 'Money in this month',
      value: formatMoney(summary.received_this_month),
    });
  }

  rows.push({
    label: 'Transactions this month',
    value: String(summary.entries_this_month),
    muted: true,
  });

  if (opening !== 0) {
    rows.push({
      label: isCreditCard ? 'Owed before tracking' : 'Opening balance',
      value: formatMoney(opening),
      muted: true,
    });
  }

  if (runningBalance !== null) {
    rows.push({ label: 'Running balance', value: formatMoney(runningBalance) });
  }

  rows.push({
    label: 'Spent all time',
    value: formatMoney(summary.lifetime_spent),
    muted: true,
  });

  return (
    <View
      className="mt-7 rounded-[26px] border px-5 py-5"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          className="flex-row items-center justify-between gap-4"
          style={{ marginTop: index === 0 ? 0 : 12 }}>
          <TText
            className="min-w-0 flex-1 text-sm"
            style={{ fontFamily: Fonts.body, color: row.muted ? '#7C8EA8' : theme.text }}>
            {row.label}
          </TText>
          <TText
            className="text-sm"
            numberOfLines={1}
            style={{ fontFamily: Fonts.title, color: row.muted ? '#7C8EA8' : theme.text }}>
            {row.value}
          </TText>
        </View>
      ))}
    </View>
  );
}

type AccountActionRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description: string;
  color: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
};

function AccountActionRow({
  icon,
  label,
  description,
  color,
  backgroundColor,
  textColor,
  mutedColor,
  onPress,
}: AccountActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[72px] flex-row items-center rounded-[22px] px-4 py-4"
      style={{ backgroundColor }}>
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/80">
        <MaterialCommunityIcons name={icon} size={21} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <TText className="text-sm" style={{ fontFamily: Fonts.title, color: textColor }}>
          {label}
        </TText>
        <TText className="mt-1 text-xs" style={{ fontFamily: Fonts.body, color: mutedColor }}>
          {description}
        </TText>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={mutedColor} />
    </Pressable>
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

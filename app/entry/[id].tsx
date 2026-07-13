import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '@/constants/Currency';
import {
  TransactionFormModal,
  type EntryForm,
} from '@/components/transactions/TransactionFormModal';
import { useAuthStore } from '@/hooks/use-auth-store';
import { Account, fetchAccounts } from '@/lib/accounts';
import { deleteEntry, fetchEntry, updateEntry, type EntryMutationPayload } from '@/lib/entries';
import { notifyTransactionsChanged } from '@/lib/transaction-events';
import {
  formatApiDate,
  normalizeDateLabel,
  parseDateLabel,
  formatDateLabel,
  toTitleCase,
  resolveCategoryMetadata,
} from '@/lib/transactions';
import { formatDisplayTime } from '@/lib/datetime';

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    category?: string;
    amount?: string;
    entryType?: 'income' | 'expense';
    section?: string;
    mode?: string;
    notes?: string;
    merchant?: string;
    dateLabel?: string;
    tag?: string;
  }>();

  const { token } = useAuthStore();
  const [transaction, setTransaction] = useState<any>(null); // Using any to be flexible with API response initially
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [isExpanded, setIsExpanded] = useState(true);

  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Hydrate state from params initially, then update with API data
  const displayData = transaction || {
    id: params.id,
    title: params.name,
    category: params.category,
    amount: Number(params.amount ?? 0),
    type: params.entryType,
    mode: params.mode,
    notes: params.notes,
    merchant: params.merchant,
    date: params.dateLabel, // formatted date label
    tag: params.tag,
    // missing fields from params will be undefined
  };

  const fetchTransactionDetails = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      const data = await fetchEntry(token, params.id);
      // Normalize API data to match display structure
      const normalized = {
        ...data,
        // Ensure consistency in naming
        title: data.title,
        type: data.type,
        amount: Number(data.amount),
        date: data.date ? normalizeDateLabel(data.date) : params.dateLabel,
        rawDate: data.date,
        time: data.time,
        tag: data.tag ? toTitleCase(data.tag) : data.tag,
      };
      setTransaction(normalized);
    } catch (error) {
      console.error('Failed to fetch transaction details', error);
    } finally {
      setIsLoading(false);
    }
  }, [params.dateLabel, params.id, token]);

  useEffect(() => {
    fetchTransactionDetails();
    if (token) {
      fetchAccounts(token)
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
  }, [fetchTransactionDetails, token]);

  const amountValue = Math.abs(Number(displayData.amount || 0));

  const meta = resolveCategoryMetadata(displayData.category, displayData.type);
  const icon = meta.icon;
  const iconColor = meta.color;
  const bgColor = meta.bgColor;

  const handleEdit = () => {
    setIsEditModalVisible(true);
  };

  const handleDelete = () => {
    Alert.alert('Forget this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget it',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            if (!token) throw new Error('Missing session.');
            await deleteEntry(token, params.id);
            notifyTransactionsChanged();
            router.back();
          } catch {
            Alert.alert('Error', 'Network error.');
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const handleSaveUpdate = async (formData: EntryForm) => {
    try {
      // Transform EntryForm back to backend payload
      // Assuming we only update text fields here. File upload usually handled separately or multipart.
      // For MVP, focus on data fields.

      const payload: EntryMutationPayload = {
        title: formData.title,
        amount: formData.amount.trim(),
        currency: formData.currency || DEFAULT_CURRENCY,
        account_id: formData.accountId,
        type: formData.type.toLowerCase(),
        mode: formData.mode,
        category: formData.category,
        notes: formData.notes,
        merchant: formData.merchant,
        tag: formData.tag,
      };

      // Date handling: EntryForm has "date" as label (e.g. 18 January 2026).
      // Backend expects YYYY-MM-DD.
      const parsedDate = parseDateLabel(formData.date);
      if (parsedDate) {
        payload.date = formatApiDate(parsedDate);
      }
      if (formData.time) {
        payload.time = formData.time; // "10:30 PM" - backend stores as string
      }

      if (!token) throw new Error('Missing session.');
      await updateEntry(token, params.id, payload);

      // Refresh logic
      await fetchTransactionDetails();
      notifyTransactionsChanged();
      setIsEditModalVisible(false);
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Failed to update transaction');
    }
  };

  const hasMerchant = displayData.merchant && displayData.merchant !== 'Unknown Location';

  // Prepare initial form data for Modal
  const editInitialData: EntryForm = {
    title: displayData.title || '',
    amount: amountValue.toString(),
    type: displayData.type ? (toTitleCase(displayData.type) ?? 'Expense') : 'Expense',
    mode: displayData.mode || 'Cash',
    category: displayData.category || 'Food',
    date: displayData.date || formatDateLabel(new Date()),
    time: displayData.time || formatDisplayTime(new Date()),
    notes: displayData.notes || '',
    tag: displayData.tag || 'General',
    currency: displayData.currency || DEFAULT_CURRENCY,
    accountId: displayData.account_id || null,
    account:
      displayData.account?.name ||
      accounts.find((account) => account.id === displayData.account_id)?.name ||
      '',
    merchant: displayData.merchant || '',
    attachment: null,
    splitEnabled: false,
    splitGroupId: null,
    splitGroupName: '',
    splitParticipants: [],
  };

  if (isLoading && !transaction) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View className="flex-row items-center px-6 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-800">
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText
          className="text-base font-bold ml-4 flex-1 text-center pr-10"
          style={{ color: theme.text }}>
          A Peek at Your Spend
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* HERO SECTION */}
        <View className="items-center mb-10">
          <View
            className="h-28 w-28 rounded-[32px] items-center justify-center shadow-lg mb-6"
            style={{
              shadowColor: theme.accent,
              shadowOpacity: 0.1,
              shadowRadius: 15,
              backgroundColor: bgColor || 'white',
            }}>
            <MaterialCommunityIcons name={icon as any} size={52} color={iconColor} />
          </View>

          <ThemedText
            className="text-4xl font-black mb-2 tracking-tight"
            style={{ color: theme.text }}>
            {CURRENCY_SYMBOL}
            {amountValue.toFixed(2)}
          </ThemedText>

          <ThemedText className="text-lg font-black mb-3" style={{ color: '#1E293B' }}>
            {displayData.title || 'Untitled Transaction'}
          </ThemedText>

          {hasMerchant && (
            <View className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1.5 shadow-sm border border-gray-100">
              <ThemedText className="text-sm font-bold text-gray-600 mr-2">
                {displayData.merchant}
              </ThemedText>
              <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            </View>
          )}
        </View>

        {/* DETAILS CARD */}
        <View className="bg-white dark:bg-gray-800 rounded-[40px] p-8 shadow-sm mb-8">
          {/* Date */}
          <View className="flex-row gap-5 mb-8">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.secondary }}>
              <MaterialCommunityIcons name="calendar-blank" size={24} color={theme.accent} />
            </View>
            <View>
              <ThemedText className="text-[10px] uppercase font-black text-gray-300 tracking-widest mb-1">
                WHEN WAS THIS?
              </ThemedText>
              <ThemedText className="text-base font-black text-slate-800 dark:text-gray-100">
                {displayData.date || 'Yesterday, Oct 24'}
              </ThemedText>
              <ThemedText className="text-xs font-bold text-gray-400">
                {displayData.time ? `At ${displayData.time}` : 'Earlier today'}
              </ThemedText>
            </View>
          </View>

          {/* Category */}
          <View className="flex-row gap-5 mb-8">
            <View
              className="h-12 w-12 rounded-full items-center justify-center"
              style={{ backgroundColor: bgColor || theme.accent }}>
              <MaterialCommunityIcons name={icon as any} size={24} color={iconColor} />
            </View>
            <View>
              <ThemedText className="text-[10px] uppercase font-black text-gray-300 tracking-widest mb-1">
                WHAT KIND OF SPEND?
              </ThemedText>
              <ThemedText className="text-base font-black text-slate-800 dark:text-gray-100">
                {displayData.category || 'Food & Drink'}
              </ThemedText>
              <ThemedText className="text-xs font-bold text-gray-400">
                Treat yourself category
              </ThemedText>
            </View>
          </View>

          {/* Separator */}
          <View className="h-[1px] bg-gray-50 mb-8 border-b border-dashed border-gray-100" />

          {/* More Details Header - Collapsible */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsExpanded(!isExpanded)}
            className="flex-row items-center justify-between mb-6">
            <ThemedText
              className="text-[10px] uppercase font-black tracking-widest"
              style={{ color: theme.accent }}>
              MORE DETAILS
            </ThemedText>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.accent}
            />
          </TouchableOpacity>

          {isExpanded && (
            <View>
              <View className="flex-row mb-8">
                {/* Payment Method */}
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-10 w-10 rounded-xl bg-gray-50 items-center justify-center border border-gray-100">
                    <MaterialCommunityIcons name="wallet-outline" size={20} color="#64748B" />
                  </View>
                  <View>
                    <ThemedText className="text-[9px] uppercase font-black text-gray-300">
                      PAYMENT METHOD
                    </ThemedText>
                    <ThemedText className="text-sm font-black text-slate-700">
                      {displayData.mode || 'UPI'}
                    </ThemedText>
                  </View>
                </View>

                {/* Account */}
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-10 w-10 rounded-xl bg-gray-50 items-center justify-center border border-gray-100">
                    <MaterialCommunityIcons name="bank-outline" size={20} color="#64748B" />
                  </View>
                  <View>
                    <ThemedText className="text-[9px] uppercase font-black text-gray-300">
                      ACCOUNT
                    </ThemedText>
                    <ThemedText className="text-sm font-black text-slate-700">
                      {displayData.account?.name || 'Not linked'}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* Tags */}
              <View className="flex-row items-start gap-3 mb-8">
                <View className="h-10 w-10 rounded-xl bg-gray-50 items-center justify-center border border-gray-100">
                  <MaterialCommunityIcons name="tag-outline" size={20} color="#64748B" />
                </View>
                <View className="flex-1">
                  <ThemedText className="text-[9px] uppercase font-black text-gray-300 mb-2">
                    TAGS
                  </ThemedText>
                  <View className="flex-row gap-2">
                    <View
                      className="rounded-full border px-3 py-1"
                      style={{ backgroundColor: theme.secondary, borderColor: theme.border }}>
                      <ThemedText
                        className="text-[10px] font-black"
                        style={{ color: theme.accent }}>
                        {displayData.tag || 'Personal'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Separator */}
          <View className="h-[1px] bg-gray-50 mb-8 border-b border-dashed border-gray-100" />

          {/* Notes Inside Card */}
          <View className="flex-row gap-5">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.secondary }}>
              <MaterialCommunityIcons name="comment-text-outline" size={24} color={theme.accent} />
            </View>
            <View className="flex-1">
              <ThemedText className="text-[10px] uppercase font-black text-gray-300 tracking-widest mb-1">
                YOUR NOTES
              </ThemedText>
              <ThemedText className="text-sm font-bold italic text-slate-500 leading-relaxed">
                {displayData.notes ? `"${displayData.notes}"` : '"No notes added."'}
              </ThemedText>
            </View>
          </View>
        </View>
        {/* ACTIONS */}
        <Pressable
          onPress={handleEdit}
          className="w-full py-5 rounded-full items-center justify-center shadow-xl mb-6 active:opacity-90"
          style={{ backgroundColor: theme.accent }}>
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons name="tune-variant" size={24} color="#FFF" />
            <ThemedText className="text-white font-black text-lg">Tweak this</ThemedText>
          </View>
        </Pressable>

        <Pressable onPress={handleDelete} className="items-center py-2 mb-10 active:opacity-50">
          <View className="flex-row items-center gap-2">
            {isDeleting ? (
              <ActivityIndicator color="#FF6B6B" />
            ) : (
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF6B6B" />
            )}
            <ThemedText className="font-bold text-[#FF6B6B]">
              {isDeleting ? 'Forgetting...' : 'Forget this transaction'}
            </ThemedText>
          </View>
        </Pressable>
      </ScrollView>

      <TransactionFormModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        initialData={editInitialData}
        onSave={handleSaveUpdate}
        isEdit={true}
        accounts={accounts}
        onManageAccounts={() => router.push('/accounts')}
      />
    </SafeAreaView>
  );
}

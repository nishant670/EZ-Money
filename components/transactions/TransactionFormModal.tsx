import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '@/constants/Currency';
import type { Account } from '@/lib/accounts';
import {
  getAccountsForPaymentMode,
  getAutoAccountPayloadForPaymentMode,
  getPreferredAccountForPaymentMode,
} from '@/lib/accounts';
import { formatDisplayTime } from '@/lib/datetime';
import { formatDateLabel, parseDateLabel } from '@/lib/transactions';

export type EntryForm = {
  title: string;
  time: string;
  amount: string;
  type: string;
  mode: string;
  category: string;
  date: string;
  notes: string;
  tag: string;
  currency: string;
  accountId: number | null;
  account: string;
  merchant: string;
  attachment: string | null;
};

export type AiReviewMetadata = {
  confidence?: Record<string, number>;
  needsConfirmation?: Record<string, boolean>;
  missingFields?: string[];
  clarifications?: string[];
};

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  initialData?: Partial<EntryForm>;
  onSave: (data: EntryForm) => Promise<void>;
  onDelete?: () => Promise<void>;
  isEdit?: boolean;
  mode?: 'audio' | 'manual' | 'quick-prompt';
  aiReview?: AiReviewMetadata | null;
  accounts?: Account[];
  onManageAccounts?: () => void;
}

const requiredFields: (keyof EntryForm)[] = ['title', 'amount', 'type', 'mode', 'category', 'date'];
const fieldLabels: Record<keyof EntryForm, string> = {
  title: 'Transaction Title',
  time: 'Time',
  amount: 'Amount',
  type: 'Type',
  mode: 'Mode',
  category: 'Category',
  date: 'Date',
  notes: 'Notes',
  tag: 'Tag',
  currency: 'Currency',
  accountId: 'Account',
  account: 'Account',
  merchant: 'Merchant',
  attachment: 'Attachment',
};

const modeOptions = ['Cash', 'UPI', 'Credit Card', 'Wallets'];
const categoryOptions = [
  'Food & Drinks',
  'Travel',
  'Shopping',
  'Bills',
  'Transport',
  'Family/Gifts',
  'Misc',
];
const tagOptions = ['Investment', 'Lending', 'EMI', 'Subscription', 'General'];
const formatFieldName = (field: string) => {
  const normalized = field === 'account_hint' ? 'account' : field;
  return normalized.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export function TransactionFormModal({
  visible,
  onClose,
  initialData,
  onSave,
  onDelete,
  isEdit,
  mode = 'manual',
  aiReview,
  accounts = [],
  onManageAccounts,
}: TransactionFormModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const accent = theme.accent;

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const [panelAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [backdropAnim] = useState(new Animated.Value(0));
  const [typeSwitchAnim] = useState(new Animated.Value(0));
  const [showModal, setShowModal] = useState(visible);
  const resolveEntryFormAccount = useCallback(
    (nextForm: EntryForm): EntryForm => {
      if (mode === 'quick-prompt') {
        return nextForm;
      }
      const preferredAccount = getPreferredAccountForPaymentMode(accounts, nextForm.mode);
      if (nextForm.accountId !== null) {
        const selectedAccount = accounts.find((account) => account.id === nextForm.accountId);
        const isCompatible = getAccountsForPaymentMode(accounts, nextForm.mode).some(
          (account) => account.id === nextForm.accountId
        );
        if (selectedAccount && isCompatible) {
          if ((nextForm.account ?? '').trim().length === 0) {
            return { ...nextForm, account: selectedAccount.name };
          }
          return nextForm;
        }
      }
      if (preferredAccount) {
        return { ...nextForm, accountId: preferredAccount.id, account: preferredAccount.name };
      }
      return { ...nextForm, accountId: null, account: '' };
    },
    [accounts, mode]
  );

  const [form, setForm] = useState<EntryForm>(() =>
    resolveEntryFormAccount({
      title: '',
      amount: '',
      type: 'Expense',
      mode: 'Cash',
      category: 'Food',
      date: formatDateLabel(new Date()),
      time: formatDisplayTime(new Date()),
      notes: '',
      tag: 'General',
      currency: DEFAULT_CURRENCY,
      accountId: null,
      account: '',
      merchant: '',
      attachment: null,
      ...initialData,
    })
  );

  const [isMoreDetailsExpanded, setIsMoreDetailsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(parseDateLabel(form.date) ?? new Date());
  const [isModePickerVisible, setIsModePickerVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  const compatibleAccounts = useMemo(
    () => getAccountsForPaymentMode(accounts, form.mode),
    [accounts, form.mode]
  );
  const pendingAutoAccountPayload = useMemo(
    () => getAutoAccountPayloadForPaymentMode(form.mode),
    [form.mode]
  );
  const willCreateAccountOnSave =
    mode !== 'quick-prompt' && compatibleAccounts.length === 0 && pendingAutoAccountPayload !== null;

  const reviewFields = useMemo(() => {
    const fields = new Set(aiReview?.missingFields ?? []);
    Object.entries(aiReview?.needsConfirmation ?? {}).forEach(([field, needsConfirmation]) => {
      if (needsConfirmation) fields.add(field);
    });
    Object.entries(aiReview?.confidence ?? {}).forEach(([field, confidence]) => {
      if (confidence < 0.7) fields.add(field);
    });
    return Array.from(fields);
  }, [aiReview]);
  const hasReviewMetadata = Boolean(
    aiReview?.confidence ||
      aiReview?.needsConfirmation ||
      aiReview?.missingFields ||
      aiReview?.clarifications
  );
  const categoryNeedsReview = reviewFields.includes('category');

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setForm(
        resolveEntryFormAccount({
          title: '',
          amount: '',
          type: 'Expense',
          mode: 'Cash',
          category: 'Food & Drinks',
          date: formatDateLabel(new Date()),
          time: formatDisplayTime(new Date()),
          notes: '',
          tag: 'General',
          currency: DEFAULT_CURRENCY,
          accountId: null,
          account: '',
          merchant: '',
          attachment: null,
          ...initialData,
        })
      );
      typeSwitchAnim.setValue((initialData?.type || 'Expense') === 'Income' ? 1 : 0);

      Animated.parallel([
        Animated.spring(panelAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(panelAnim, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
    // Keep this tied to the visibility transition. Adding initialData would
    // reset in-progress edits whenever the parent re-renders with a new object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, SCREEN_HEIGHT, backdropAnim, panelAnim, resolveEntryFormAccount, typeSwitchAnim]);

  useEffect(() => {
    if (!visible || mode === 'quick-prompt') {
      return;
    }
    setForm((prev) => {
      const next = resolveEntryFormAccount(prev);
      return next.accountId === prev.accountId && next.account === prev.account ? prev : next;
    });
  }, [visible, mode, form.mode, resolveEntryFormAccount]);

  const animateTypeSwitch = useCallback(
    (isIncome: boolean) => {
      Animated.spring(typeSwitchAnim, {
        toValue: isIncome ? 1 : 0,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    },
    [typeSwitchAnim]
  );

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDateLabel(form.date) ?? new Date(),
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            const dateStr = formatDateLabel(selectedDate);
            setForm((prev) => ({ ...prev, date: dateStr }));
            DateTimePickerAndroid.open({
              value: new Date(),
              mode: 'time',
              is24Hour: false,
              onChange: (event: DateTimePickerEvent, selectedTime?: Date) => {
                if (event.type === 'set' && selectedTime) {
                  const timeStr = formatDisplayTime(selectedTime);
                  setForm((prev) => ({ ...prev, time: timeStr }));
                }
              },
            });
          }
        },
        mode: 'date',
      });
    } else {
      setPendingDate(parseDateLabel(form.date) ?? new Date());
      setIsDatePickerVisible(true);
    }
  };

  const handleConfirmDatePicker = () => {
    setForm((prev) => ({
      ...prev,
      date: formatDateLabel(pendingDate),
      time: formatDisplayTime(pendingDate),
    }));
    setIsDatePickerVisible(false);
  };

  const handleConfirmEntry = async () => {
    const missingField = requiredFields.find((field) => {
      const value = form[field];
      return typeof value === 'string' ? value.trim().length === 0 : !value;
    });

    if (missingField) {
      setFormError(`Please provide ${fieldLabels[missingField]}.`);
      return;
    }
    if (mode !== 'quick-prompt' && form.accountId === null && !willCreateAccountOnSave) {
      setFormError(
        compatibleAccounts.length === 0
          ? `Add a ${form.mode || 'matching'} account before saving this transaction.`
          : 'Please select an account.'
      );
      return;
    }

    const amountValue = Number(form.amount);
    if (Number.isNaN(amountValue)) {
      setFormError('Please enter a valid amount.');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!showModal) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none" // we handle animations manually for better control
      onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View className="absolute inset-0 bg-black/40" style={{ opacity: backdropAnim }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={{
            transform: [{ translateY: panelAnim }],
            height: '92%',
            width: '100%',
          }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1">
            <View
              className="flex-1 rounded-t-[40px] shadow-2xl relative overflow-hidden"
              style={{ backgroundColor: theme.background }}>
              <View className="items-center pt-8 pb-2 relative">
                <View className="h-1.5 w-12 rounded-full absolute top-3 bg-gray-200" />
                <Pressable
                  onPress={onClose}
                  className="absolute right-6 top-6 h-10 w-10 rounded-full bg-gray-100 items-center justify-center z-10">
                  <MaterialCommunityIcons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: '90%' }}
                contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="items-center px-6 mb-8">
                  <ThemedText
                    className="text-xl font-black mt-6 mb-2"
                    style={{ color: theme.text }}>
                    {isEdit
                      ? mode === 'quick-prompt'
                        ? 'Edit Quick Prompt'
                        : 'Update Details'
                      : mode === 'audio'
                        ? "I've sorted the details!"
                        : mode === 'quick-prompt'
                          ? 'New Quick Prompt'
                          : 'New Transaction'}
                  </ThemedText>
                  <ThemedText className="text-center text-gray-500 text-sm leading-5 px-4">
                    {isEdit
                      ? 'Make your changes and confirm below.'
                      : mode === 'audio'
                        ? "Here's the AI draft. Review every field before you save."
                        : mode === 'quick-prompt'
                          ? 'These details will be used for your shortcut.'
                          : 'Fill in the transaction details below.'}
                  </ThemedText>
                </View>

                <View className="px-6 mb-8">
                  {mode === 'audio' && (
                    <View className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <MaterialCommunityIcons
                            name="creation-outline"
                            size={18}
                            color="#D97706"
                          />
                          <ThemedText className="ml-2 text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                            AI draft
                          </ThemedText>
                        </View>
                        <View className="rounded-full border border-amber-200 bg-white px-2 py-1 dark:border-amber-800 dark:bg-gray-800">
                          <ThemedText className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">
                            {reviewFields.length > 0
                              ? `${reviewFields.length} field${reviewFields.length === 1 ? '' : 's'} to check`
                              : hasReviewMetadata
                                ? 'No issues flagged'
                                : 'Review all fields'}
                          </ThemedText>
                        </View>
                      </View>
                      {reviewFields.length > 0 && (
                        <ThemedText className="mt-3 text-sm font-bold text-amber-900 dark:text-amber-100">
                          Check: {reviewFields.map(formatFieldName).join(', ')}
                        </ThemedText>
                      )}
                      {aiReview?.clarifications?.map((clarification) => (
                        <View key={clarification} className="mt-2 flex-row items-start">
                          <MaterialCommunityIcons
                            name="help-circle-outline"
                            size={16}
                            color="#D97706"
                          />
                          <ThemedText className="ml-2 flex-1 text-sm text-amber-900 dark:text-amber-100">
                            {clarification}
                          </ThemedText>
                        </View>
                      ))}
                      <ThemedText className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                        AI suggestions are never saved until you confirm.
                      </ThemedText>
                    </View>
                  )}

                  <View className="mb-6">
                    <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">
                      Transaction Type
                    </ThemedText>
                    <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-[24px] p-1.5 relative overflow-hidden">
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 6,
                          bottom: 6,
                          left: 6,
                          width: '48%',
                          backgroundColor: form.type === 'Expense' ? '#F97316' : '#10B981',
                          borderRadius: 20,
                          transform: [
                            {
                              translateX: typeSwitchAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, (Dimensions.get('window').width - 60) * 0.5],
                              }),
                            },
                          ],
                        }}
                        className="shadow-sm"
                      />
                      <Pressable
                        onPress={() => {
                          setForm((p) => ({ ...p, type: 'Expense' }));
                          animateTypeSwitch(false);
                        }}
                        className="flex-1 py-4 items-center justify-center z-10">
                        <ThemedText
                          className={`text-sm font-black tracking-tight ${form.type === 'Expense' ? 'text-white' : 'text-gray-400'}`}>
                          EXPENSE
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setForm((p) => ({ ...p, type: 'Income' }));
                          animateTypeSwitch(true);
                        }}
                        className="flex-1 py-4 items-center justify-center z-10">
                        <ThemedText
                          className={`text-sm font-black tracking-tight ${form.type === 'Income' ? 'text-white' : 'text-gray-400'}`}>
                          INCOME
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View className="bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm mb-4">
                    <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                      Transaction Title
                    </ThemedText>
                    <View className="flex-row items-center gap-3">
                      <MaterialCommunityIcons
                        name="label-variant-outline"
                        size={24}
                        color="#F97316"
                      />
                      <TextInput
                        value={form.title}
                        onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                        className="text-base font-black flex-1 p-0"
                        style={{ color: theme.text, height: 28 }}
                        placeholder="Short title"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm h-32 justify-between">
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                        Amount
                      </ThemedText>
                      <View className="flex-row items-center gap-1">
                        <ThemedText className="text-xl font-black text-orange-400">
                          {CURRENCY_SYMBOL}
                        </ThemedText>
                        <TextInput
                          value={form.amount}
                          onChangeText={(text) => setForm((p) => ({ ...p, amount: text }))}
                          className="text-2xl font-black p-0 flex-1"
                          style={{ color: theme.text, height: 40 }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setIsModePickerVisible(true)}
                      className="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm h-32 justify-between">
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                        Paid Via
                      </ThemedText>
                      <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons name="cash-multiple" size={24} color="#8B5CF6" />
                        <ThemedText className="text-lg font-black" style={{ color: theme.text }}>
                          {form.mode}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>

                  {mode !== 'quick-prompt' && (
                    <>
                      <Pressable
                        onPress={handleOpenDatePicker}
                        className="w-full bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm flex-row items-center justify-between">
                        <View>
                          <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                            Date & Time
                          </ThemedText>
                          <View className="flex-row items-center gap-3">
                            <View className="h-10 w-10 rounded-xl bg-purple-50 items-center justify-center">
                              <MaterialCommunityIcons
                                name="calendar-multiselect"
                                size={20}
                                color="#8B5CF6"
                              />
                            </View>
                            <ThemedText className="text-sm font-bold" style={{ color: theme.text }}>
                              {form.date}, {form.time}
                            </ThemedText>
                          </View>
                        </View>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color="#D1D5DB" />
                      </Pressable>
                      <Pressable
                        onPress={() => setIsAccountPickerVisible(true)}
                        className="mt-4 w-full bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm flex-row items-center justify-between">
                        <View className="flex-row items-center gap-4">
                          <View className="h-12 w-12 rounded-2xl bg-blue-50 items-center justify-center">
                            <MaterialCommunityIcons
                              name="wallet-outline"
                              size={24}
                              color="#3B82F6"
                            />
                          </View>
                          <View>
                            <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                              Paid from account
                            </ThemedText>
                            <ThemedText className="text-sm font-bold" style={{ color: theme.text }}>
                              {form.account ||
                                (willCreateAccountOnSave
                                  ? `${pendingAutoAccountPayload?.name} will be created`
                                  : compatibleAccounts.length === 0
                                    ? `Add a ${form.mode || 'matching'} account`
                                    : 'Select an account')}
                            </ThemedText>
                            {willCreateAccountOnSave && (
                              <ThemedText className="mt-1 text-[11px] font-medium text-gray-400">
                                First transaction will set it up automatically.
                              </ThemedText>
                            )}
                          </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={24} color="#D1D5DB" />
                      </Pressable>
                    </>
                  )}
                </View>

                <View className="px-6 mb-8">
                  <ThemedText className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic mb-4">
                    {categoryNeedsReview ? 'Needs Attention' : 'Category'}
                  </ThemedText>
                  <View className="relative mb-4">
                    {categoryNeedsReview && (
                      <View className="absolute -top-3 right-4 z-10 bg-yellow-400 px-2 py-0.5 rounded-lg">
                        <ThemedText className="text-[8px] font-black text-black">
                          Check this
                        </ThemedText>
                      </View>
                    )}
                    <Pressable
                      onPress={() => setIsCategoryPickerVisible(true)}
                      className={`w-full rounded-[28px] p-4 border flex-row items-center justify-between ${
                        categoryNeedsReview
                          ? 'bg-[#FFFCF0] dark:bg-gray-800/50 border-yellow-100'
                          : 'bg-white dark:bg-gray-800 border-gray-100'
                      }`}>
                      <View className="flex-row items-center gap-4">
                        <View className="h-12 w-12 rounded-2xl bg-orange-100 items-center justify-center">
                          <MaterialCommunityIcons name="car-outline" size={24} color="#F59E0B" />
                        </View>
                        <View>
                          <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                            Category
                          </ThemedText>
                          <ThemedText
                            className="text-base font-black"
                            style={{ color: theme.text }}>
                            {form.category}
                          </ThemedText>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={24} color="#D1D5DB" />
                    </Pressable>
                  </View>
                </View>

                <View className="px-6 mb-6">
                  <Pressable
                    onPress={() => setIsMoreDetailsExpanded(!isMoreDetailsExpanded)}
                    className="flex-row items-center justify-between py-4 border-b border-gray-50">
                    <View className="flex-row items-center gap-2">
                      <MaterialCommunityIcons name="tune-variant" size={20} color={theme.text} />
                      <ThemedText className="text-sm font-black opacity-60">
                        More details
                      </ThemedText>
                    </View>
                    <MaterialCommunityIcons
                      name={isMoreDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={theme.text}
                      className="opacity-40"
                    />
                  </Pressable>

                  {isMoreDetailsExpanded && (
                    <View className="mt-6 gap-6">
                      <View className="flex-row gap-4">
                        <View className="flex-1">
                          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">
                            Merchant
                          </ThemedText>
                          <View className="bg-gray-50 dark:bg-gray-800/50 rounded-[24px] p-4 flex-row items-center gap-2">
                            <View className="h-6 w-6 rounded-lg bg-red-100 items-center justify-center">
                              <MaterialCommunityIcons
                                name="storefront-outline"
                                size={14}
                                color="#EF4444"
                              />
                            </View>
                            <TextInput
                              value={form.merchant}
                              onChangeText={(t) => setForm((p) => ({ ...p, merchant: t }))}
                              className="text-sm font-black flex-1 p-0"
                              placeholder="Store Name"
                              style={{ color: theme.text }}
                            />
                          </View>
                        </View>
                      </View>

                      <View>
                        <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">
                          Tags
                        </ThemedText>
                        <View className="flex-row flex-wrap gap-2">
                          {tagOptions.map((tag) => (
                            <Pressable
                              key={tag}
                              onPress={() => setForm((p) => ({ ...p, tag }))}
                              className={`px-4 py-2 rounded-full border ${form.tag === tag ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}>
                              <ThemedText
                                className={`text-xs font-bold ${form.tag === tag ? 'text-orange-400' : 'text-gray-500'}`}>
                                {tag}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View>
                        <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">
                          Notes
                        </ThemedText>
                        <TextInput
                          multiline
                          placeholder="Add a note..."
                          placeholderTextColor="#D1D5DB"
                          value={form.notes}
                          onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-[24px] p-5 text-sm min-h-[100px]"
                          textAlignVertical="top"
                          style={{ color: theme.text }}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View className="px-6 gap-4">
                  <Pressable
                    onPress={handleConfirmEntry}
                    disabled={isSaving}
                    style={{ backgroundColor: accent }}
                    className="w-full py-5 rounded-[24px] flex-row items-center justify-center gap-2 shadow-lg">
                    {isSaving ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <ThemedText className="text-base font-black text-white">
                          {isEdit
                            ? mode === 'quick-prompt'
                              ? 'Save Prompt'
                              : 'Update Details'
                            : mode === 'quick-prompt'
                              ? 'Create Prompt'
                              : 'Confirm & Save'}
                        </ThemedText>
                        <MaterialCommunityIcons
                          name="check-circle-outline"
                          size={24}
                          color="white"
                        />
                      </>
                    )}
                  </Pressable>
                  {onDelete && (
                    <Pressable
                      onPress={onDelete}
                      className="w-full py-4 items-center justify-center active:opacity-50">
                      <ThemedText className="font-bold text-red-500">Forget this prompt</ThemedText>
                    </Pressable>
                  )}
                  {formError && (
                    <ThemedText className="text-center text-red-500 text-xs mt-2">
                      {formError}
                    </ThemedText>
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>

        {/* Date Picker Modal (iOS) */}
        {Platform.OS === 'ios' && isDatePickerVisible && (
          <Modal transparent animationType="fade" visible={isDatePickerVisible}>
            <View className="flex-1 justify-end bg-black/30">
              <Pressable className="flex-1" onPress={() => setIsDatePickerVisible(false)} />
              <View
                className="rounded-t-3xl px-4 pb-6 pt-4"
                style={{ backgroundColor: theme.background }}>
                <ThemedText className="text-center text-sm font-bold">
                  Select Date & Time
                </ThemedText>
                <DateTimePicker
                  value={pendingDate}
                  mode="datetime"
                  display="spinner"
                  onChange={(_e, d) => d && setPendingDate(d)}
                  style={{ width: '100%' }}
                />
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    className="flex-1 items-center rounded-2xl border py-3 border-gray-100"
                    onPress={() => setIsDatePickerVisible(false)}>
                    <ThemedText>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    className="flex-1 items-center rounded-2xl py-3"
                    style={{ backgroundColor: accent }}
                    onPress={handleConfirmDatePicker}>
                    <ThemedText className="text-white font-bold">Set Date</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Mode Picker */}
        <Modal transparent animationType="fade" visible={isModePickerVisible}>
          <View className="flex-1 justify-end bg-black/30">
            <Pressable className="flex-1" onPress={() => setIsModePickerVisible(false)} />
            <View
              className="rounded-t-3xl px-4 pb-10 pt-4"
              style={{ backgroundColor: theme.background }}>
              <ThemedText className="text-center text-base font-bold mb-6">
                Select Payment Method
              </ThemedText>
              <View className="gap-2">
                {modeOptions.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setForm((p) => resolveEntryFormAccount({ ...p, mode: m }));
                      setIsModePickerVisible(false);
                    }}
                    className={`p-4 rounded-2xl flex-row items-center justify-between ${form.mode === m ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                    <ThemedText
                      className={`font-bold ${form.mode === m ? 'text-orange-500' : 'text-gray-700'}`}>
                      {m}
                    </ThemedText>
                    {form.mode === m && (
                      <MaterialCommunityIcons name="check" size={20} color="#F97316" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* Category Picker */}
        <Modal transparent animationType="fade" visible={isCategoryPickerVisible}>
          <View className="flex-1 justify-end bg-black/30">
            <Pressable className="flex-1" onPress={() => setIsCategoryPickerVisible(false)} />
            <View
              className="rounded-t-3xl px-4 pb-10 pt-4"
              style={{ backgroundColor: theme.background }}>
              <ThemedText className="text-center text-base font-bold mb-6">
                Select Category
              </ThemedText>
              <ScrollView style={{ maxHeight: 400 }}>
                <View className="flex-row flex-wrap gap-4 justify-between">
                  {categoryOptions.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setForm((p) => ({ ...p, category: c }));
                        setIsCategoryPickerVisible(false);
                      }}
                      className={`w-[47%] p-4 rounded-3xl items-center gap-2 border ${form.category === c ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-transparent'}`}>
                      <ThemedText
                        className={`text-xs font-bold ${form.category === c ? 'text-orange-500' : 'text-gray-700'}`}>
                        {c}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Account Picker */}
        <Modal transparent animationType="fade" visible={isAccountPickerVisible}>
          <View className="flex-1 justify-end bg-black/30">
            <Pressable className="flex-1" onPress={() => setIsAccountPickerVisible(false)} />
            <View
              className="rounded-t-3xl px-4 pb-10 pt-4"
              style={{ backgroundColor: theme.background }}>
              <ThemedText className="text-center text-base font-bold mb-6">
                Select Account
              </ThemedText>
              <View className="gap-2">
                {compatibleAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      setForm((p) => ({ ...p, accountId: account.id, account: account.name }));
                      setIsAccountPickerVisible(false);
                    }}
                    className={`p-4 rounded-2xl flex-row items-center justify-between ${form.accountId === account.id ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                    <View>
                      <ThemedText
                        className={`font-bold ${form.accountId === account.id ? 'text-blue-500' : 'text-gray-700'}`}>
                        {account.name}
                      </ThemedText>
                      <ThemedText className="text-xs text-gray-400">
                        {account.provider || account.type}
                      </ThemedText>
                    </View>
                    {form.accountId === account.id && (
                      <MaterialCommunityIcons name="check" size={20} color="#3B82F6" />
                    )}
                  </Pressable>
                ))}
                {compatibleAccounts.length === 0 && (
                  <View className="items-center gap-4 py-4">
                    <ThemedText className="text-center text-sm text-gray-500">
                      {willCreateAccountOnSave
                        ? `${pendingAutoAccountPayload?.name} will be created when you save.`
                        : `No ${form.mode || 'matching'} account found.`}
                    </ThemedText>
                    {onManageAccounts && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setIsAccountPickerVisible(false);
                          onClose();
                          onManageAccounts();
                        }}
                        className="rounded-2xl px-5 py-3"
                        style={{ backgroundColor: accent }}>
                        <ThemedText className="font-bold text-white">Manage accounts</ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

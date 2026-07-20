import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '@/constants/Currency';
import type { Account } from '@/lib/accounts';
import {
  getAccountsForPaymentMode,
  getAutoAccountPayloadForPaymentMode,
  getPreferredAccountForPaymentMode,
} from '@/lib/accounts';
import { formatDisplayTime } from '@/lib/datetime';
import type { SplitFriend, SplitGroup } from '@/lib/splits';
import type { BillingInterval } from '@/lib/subscriptions';
import { formatDateLabel, parseDateLabel } from '@/lib/transactions';

export type SplitParticipantForm = {
  friendId: number | null;
  friendName: string;
  shareAmount: string;
  direction: 'friend_owes_user' | 'user_owes_friend';
};

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
  splitEnabled: boolean;
  splitGroupId: number | null;
  splitGroupName: string;
  splitParticipants: SplitParticipantForm[];
  subscriptionEnabled: boolean;
  subscriptionName: string;
  subscriptionMerchant: string;
  subscriptionCategory: string;
  subscriptionAmount: string;
  subscriptionBillingInterval: BillingInterval | '';
  subscriptionNextDueDate: string;
  subscriptionReminderDays: string;
  subscriptionCancelBeforeDue: boolean;
  subscriptionNotes: string;
};

export type AiReviewMetadata = {
  confidence?: Record<string, number>;
  needsConfirmation?: Record<string, boolean>;
  missingFields?: string[];
  clarifications?: string[];
  smartSortingDisabled?: boolean;
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
  splitFriends?: SplitFriend[];
  splitGroups?: SplitGroup[];
  onManageAccounts?: () => void;
  onDraftChange?: (data: EntryForm) => void;
}

const emptyAccounts: Account[] = [];
const emptySplitFriends: SplitFriend[] = [];
const emptySplitGroups: SplitGroup[] = [];

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
  splitEnabled: 'Split',
  splitGroupId: 'Split group',
  splitGroupName: 'Split group',
  splitParticipants: 'Split shares',
  subscriptionEnabled: 'Subscription',
  subscriptionName: 'Subscription name',
  subscriptionMerchant: 'Subscription merchant',
  subscriptionCategory: 'Subscription category',
  subscriptionAmount: 'Subscription amount',
  subscriptionBillingInterval: 'Billing interval',
  subscriptionNextDueDate: 'Next payment date',
  subscriptionReminderDays: 'Reminder',
  subscriptionCancelBeforeDue: 'Cancellation reminder',
  subscriptionNotes: 'Subscription notes',
};

const modeOptions = ['Cash', 'UPI', 'Credit Card', 'Wallets'];
const subscriptionIntervalOptions: BillingInterval[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
];
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
  accounts = emptyAccounts,
  splitFriends = emptySplitFriends,
  splitGroups = emptySplitGroups,
  onManageAccounts,
  onDraftChange,
}: TransactionFormModalProps) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const colorScheme = themeTokens.mode;
  const accent = theme.accent;
  const accentSurface = colorScheme === 'dark' ? theme.secondary : theme.secondary;
  const detailInputPlaceholderColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.45)' : '#9CA3AF';
  const detailIconSurface = colorScheme === 'dark' ? theme.secondary : accentSurface;

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
      splitEnabled: false,
      splitGroupId: null,
      splitGroupName: '',
      splitParticipants: [],
      subscriptionEnabled: false,
      subscriptionName: '',
      subscriptionMerchant: '',
      subscriptionCategory: '',
      subscriptionAmount: '',
      subscriptionBillingInterval: '',
      subscriptionNextDueDate: '',
      subscriptionReminderDays: '3',
      subscriptionCancelBeforeDue: false,
      subscriptionNotes: '',
      ...initialData,
    })
  );

  const [isMoreDetailsExpanded, setIsMoreDetailsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDiscardDialogVisible, setIsDiscardDialogVisible] = useState(false);

  useEffect(() => {
    if (visible) onDraftChange?.(form);
  }, [form, onDraftChange, visible]);

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
    mode !== 'quick-prompt' &&
    compatibleAccounts.length === 0 &&
    pendingAutoAccountPayload !== null;

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
          splitEnabled: false,
          splitGroupId: null,
          splitGroupName: '',
          splitParticipants: [],
          subscriptionEnabled: false,
          subscriptionName: '',
          subscriptionMerchant: '',
          subscriptionCategory: '',
          subscriptionAmount: '',
          subscriptionBillingInterval: '',
          subscriptionNextDueDate: '',
          subscriptionReminderDays: '3',
          subscriptionCancelBeforeDue: false,
          subscriptionNotes: '',
          ...initialData,
        })
      );
      typeSwitchAnim.setValue((initialData?.type || 'Expense') === 'Income' ? 1 : 0);

      Animated.parallel([
        Animated.spring(panelAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(panelAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
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
    if (form.splitEnabled) {
      if (form.type !== 'Expense') {
        setFormError('Splits can be added only to expenses.');
        return;
      }
      if (form.splitParticipants.length === 0) {
        setFormError('Add at least one friend share for the split.');
        return;
      }
      const totalSplit = form.splitParticipants.reduce(
        (sum, participant) => sum + Number(participant.shareAmount || 0),
        0
      );
      const invalidParticipant = form.splitParticipants.find(
        (participant) =>
          Number(participant.shareAmount || 0) <= 0 ||
          (!participant.friendId && participant.friendName.trim().length === 0)
      );
      if (invalidParticipant) {
        setFormError('Each split share needs a friend and a positive amount.');
        return;
      }
      if (totalSplit > amountValue) {
        setFormError('Split shares cannot exceed the transaction amount.');
        return;
      }
    }
    if (form.subscriptionEnabled) {
      const subscriptionAmount = Number(form.subscriptionAmount || form.amount);
      const reminderDays = Number(form.subscriptionReminderDays || 0);
      if (form.subscriptionName.trim().length === 0) {
        setFormError('Please provide Subscription name.');
        return;
      }
      if (!Number.isFinite(subscriptionAmount) || subscriptionAmount <= 0) {
        setFormError('Please enter a valid subscription amount.');
        return;
      }
      if (!form.subscriptionBillingInterval) {
        setFormError('Please choose Billing interval.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.subscriptionNextDueDate.trim())) {
        setFormError('Please enter Next payment date as YYYY-MM-DD.');
        return;
      }
      if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) {
        setFormError('Reminder must be between 0 and 30 days.');
        return;
      }
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

  const addSplitParticipant = () => {
    const amountValue = Number(form.amount || 0);
    const defaultShare = amountValue > 0 ? (amountValue / 2).toFixed(2) : '';
    setForm((prev) => ({
      ...prev,
      splitParticipants: [
        ...prev.splitParticipants,
        {
          friendId: splitFriends[0]?.id ?? null,
          friendName: '',
          shareAmount: defaultShare,
          direction: 'friend_owes_user',
        },
      ],
    }));
  };

  const updateSplitParticipant = (index: number, updates: Partial<SplitParticipantForm>) => {
    setForm((prev) => ({
      ...prev,
      splitParticipants: prev.splitParticipants.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, ...updates } : participant
      ),
    }));
  };

  const removeSplitParticipant = (index: number) => {
    setForm((prev) => ({
      ...prev,
      splitParticipants: prev.splitParticipants.filter(
        (_, participantIndex) => participantIndex !== index
      ),
    }));
  };

  const requestClose = useCallback(() => {
    if (mode !== 'audio') {
      onClose();
      return;
    }
    setIsDiscardDialogVisible(true);
  }, [mode, onClose]);

  if (!showModal) return null;

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none" // we handle animations manually for better control
      onRequestClose={requestClose}>
      <View className="flex-1 justify-end">
        <Animated.View className="absolute inset-0 bg-black/40" style={{ opacity: backdropAnim }}>
          <View style={{ flex: 1 }} />
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
              className="flex-1 rounded-t-[32px] shadow-2xl relative overflow-hidden"
              style={{ backgroundColor: theme.background }}>
              <View className="items-center pt-6 pb-1 relative">
                <View className="h-1.5 w-12 rounded-full absolute top-3 bg-gray-200" />
                <Pressable
                  onPress={requestClose}
                  className="absolute right-5 top-5 h-9 w-9 rounded-full items-center justify-center z-10"
                  style={{ backgroundColor: colorScheme === 'dark' ? theme.card : '#F3F4F6' }}>
                  <MaterialCommunityIcons name="close" size={18} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: '90%' }}
                contentContainerStyle={{ paddingBottom: 28 }}>
                <View className="items-center px-5 mb-6">
                  <ThemedText
                    className="text-xl font-black mt-4 mb-1.5"
                    style={{ color: theme.text }}>
                    {isEdit
                      ? mode === 'quick-prompt'
                        ? 'Edit Quick Prompt'
                        : 'Update Details'
                      : mode === 'audio'
                        ? aiReview?.smartSortingDisabled
                          ? 'Review AI Draft'
                          : "I've sorted the details!"
                        : mode === 'quick-prompt'
                          ? 'New Quick Prompt'
                          : 'New Transaction'}
                  </ThemedText>
                  <ThemedText className="text-center text-gray-500 text-sm leading-5 px-3">
                    {isEdit
                      ? 'Make your changes and confirm below.'
                      : mode === 'audio'
                        ? aiReview?.smartSortingDisabled
                          ? 'Smart Sorting is off, so choose the category and payment details before saving.'
                          : "Here's the AI draft. Review every field before you save."
                        : mode === 'quick-prompt'
                          ? 'These details will be used for your shortcut.'
                          : 'Fill in the transaction details below.'}
                  </ThemedText>
                </View>

                <View className="px-5 mb-6">
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

                  <View className="mb-4">
                    <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 italic">
                      Transaction Type
                    </ThemedText>
                    <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-[22px] p-1 relative overflow-hidden">
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 4,
                          bottom: 4,
                          left: 4,
                          width: '48%',
                          backgroundColor: form.type === 'Expense' ? accent : '#10B981',
                          borderRadius: 18,
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
                        className="flex-1 py-3 items-center justify-center z-10">
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
                        className="flex-1 py-3 items-center justify-center z-10">
                        <ThemedText
                          className={`text-sm font-black tracking-tight ${form.type === 'Income' ? 'text-white' : 'text-gray-400'}`}>
                          INCOME
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View
                    className="rounded-[20px] p-3 border shadow-sm mb-3"
                    style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                      Transaction Title
                    </ThemedText>
                    <View className="flex-row items-center gap-3">
                      <MaterialCommunityIcons
                        name="label-variant-outline"
                        size={22}
                        color={accent}
                      />
                      <TextInput
                        testID="entry-title-input"
                        value={form.title}
                        onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                        className="text-base font-black flex-1 p-0"
                        style={{ color: theme.text, height: 24 }}
                        placeholder="Short title"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-3 mb-3">
                    <View
                      className="flex-1 rounded-[20px] p-3 border shadow-sm h-24 justify-between"
                      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                        Amount
                      </ThemedText>
                      <View className="flex-row items-center gap-1">
                        <ThemedText className="text-lg font-black" style={{ color: accent }}>
                          {CURRENCY_SYMBOL}
                        </ThemedText>
                        <TextInput
                          testID="entry-amount-input"
                          value={form.amount}
                          onChangeText={(text) => setForm((p) => ({ ...p, amount: text }))}
                          className="text-xl font-black p-0 flex-1"
                          style={{ color: theme.text, height: 32 }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setIsModePickerVisible(true)}
                      className="flex-1 rounded-[20px] p-3 border shadow-sm h-24 justify-between"
                      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                        Paid Via
                      </ThemedText>
                      <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons name="cash-multiple" size={21} color="#8B5CF6" />
                        <ThemedText className="text-base font-black" style={{ color: theme.text }}>
                          {form.mode}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>

                  {mode !== 'quick-prompt' && (
                    <>
                      <Pressable
                        onPress={handleOpenDatePicker}
                        className="w-full rounded-[20px] p-3 border shadow-sm flex-row items-center justify-between"
                        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                        <View>
                          <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                            Date & Time
                          </ThemedText>
                          <View className="flex-row items-center gap-3">
                            <View className="h-9 w-9 rounded-xl bg-purple-50 items-center justify-center">
                              <MaterialCommunityIcons
                                name="calendar-multiselect"
                                size={18}
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
                        testID="entry-account-picker"
                        onPress={() => setIsAccountPickerVisible(true)}
                        className="mt-3 w-full rounded-[20px] p-3 border shadow-sm flex-row items-center justify-between"
                        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                        <View className="flex-row items-center gap-3 flex-1 pr-2">
                          <View className="h-10 w-10 rounded-2xl bg-blue-50 items-center justify-center">
                            <MaterialCommunityIcons
                              name="wallet-outline"
                              size={21}
                              color="#3B82F6"
                            />
                          </View>
                          <View className="flex-1">
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

                {mode !== 'quick-prompt' && form.type === 'Expense' && (
                  <View className="px-5 mb-6">
                    <View
                      className="rounded-[24px] border p-3"
                      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                          <View
                            className="h-10 w-10 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: accentSurface }}>
                            <MaterialCommunityIcons
                              name="account-multiple-outline"
                              size={20}
                              color={accent}
                            />
                          </View>
                          <View>
                            <ThemedText
                              className="text-sm font-black"
                              style={{ color: theme.text }}>
                              Split this expense
                            </ThemedText>
                            <ThemedText className="text-xs text-gray-500">
                              Track friends who owe you back.
                            </ThemedText>
                          </View>
                        </View>
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityState={{ checked: form.splitEnabled }}
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              splitEnabled: !prev.splitEnabled,
                              splitParticipants:
                                !prev.splitEnabled && prev.splitParticipants.length === 0
                                  ? [
                                      {
                                        friendId: splitFriends[0]?.id ?? null,
                                        friendName: '',
                                        shareAmount: prev.amount
                                          ? (Number(prev.amount || 0) / 2).toFixed(2)
                                          : '',
                                        direction: 'friend_owes_user',
                                      },
                                    ]
                                  : prev.splitParticipants,
                            }))
                          }
                          className="h-8 w-14 justify-center rounded-full px-1"
                          style={{ backgroundColor: form.splitEnabled ? accent : '#E5E7EB' }}>
                          <View
                            className="h-6 w-6 rounded-full bg-white"
                            style={{ alignSelf: form.splitEnabled ? 'flex-end' : 'flex-start' }}
                          />
                        </Pressable>
                      </View>

                      {form.splitEnabled && (
                        <View className="mt-5 gap-4">
                          {splitGroups.length > 0 && (
                            <View>
                              <ThemedText className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Group
                              </ThemedText>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View className="flex-row gap-2">
                                  <Pressable
                                    onPress={() => setForm((p) => ({ ...p, splitGroupId: null }))}
                                    className="rounded-full border px-4 py-2"
                                    style={{
                                      backgroundColor:
                                        form.splitGroupId === null ? accentSurface : 'transparent',
                                      borderColor:
                                        form.splitGroupId === null ? accent : theme.border,
                                    }}>
                                    <ThemedText
                                      className="text-xs font-bold"
                                      style={{
                                        color: form.splitGroupId === null ? accent : theme.text,
                                      }}>
                                      New
                                    </ThemedText>
                                  </Pressable>
                                  {splitGroups.map((group) => (
                                    <Pressable
                                      key={group.id}
                                      onPress={() =>
                                        setForm((p) => ({
                                          ...p,
                                          splitGroupId: group.id,
                                          splitGroupName: '',
                                        }))
                                      }
                                      className="rounded-full border px-4 py-2"
                                      style={{
                                        backgroundColor:
                                          form.splitGroupId === group.id
                                            ? accentSurface
                                            : 'transparent',
                                        borderColor:
                                          form.splitGroupId === group.id ? accent : theme.border,
                                      }}>
                                      <ThemedText
                                        className="text-xs font-bold"
                                        style={{
                                          color:
                                            form.splitGroupId === group.id ? accent : theme.text,
                                        }}>
                                        {group.name}
                                      </ThemedText>
                                    </Pressable>
                                  ))}
                                </View>
                              </ScrollView>
                            </View>
                          )}

                          {form.splitGroupId === null && (
                            <View className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                              <ThemedText className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                New group name
                              </ThemedText>
                              <TextInput
                                value={form.splitGroupName}
                                onChangeText={(text) =>
                                  setForm((p) => ({ ...p, splitGroupName: text }))
                                }
                                placeholder="Trip, flatmates, dinner crew"
                                placeholderTextColor="#9CA3AF"
                                className="p-0 text-sm font-bold"
                                style={{ color: theme.text }}
                              />
                            </View>
                          )}

                          <View className="gap-3">
                            {form.splitParticipants.map((participant, index) => (
                              <View
                                key={index}
                                className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                                <View className="flex-row items-center justify-between">
                                  <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Share {index + 1}
                                  </ThemedText>
                                  <Pressable onPress={() => removeSplitParticipant(index)}>
                                    <MaterialCommunityIcons
                                      name="close"
                                      size={18}
                                      color={theme.text}
                                    />
                                  </Pressable>
                                </View>
                                {splitFriends.length > 0 && (
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    className="mt-3">
                                    <View className="flex-row gap-2">
                                      <Pressable
                                        onPress={() =>
                                          updateSplitParticipant(index, { friendId: null })
                                        }
                                        className="rounded-full border px-3 py-2"
                                        style={{
                                          backgroundColor:
                                            participant.friendId === null
                                              ? accentSurface
                                              : 'transparent',
                                          borderColor:
                                            participant.friendId === null ? accent : theme.border,
                                        }}>
                                        <ThemedText
                                          className="text-xs font-bold"
                                          style={{
                                            color:
                                              participant.friendId === null ? accent : theme.text,
                                          }}>
                                          New friend
                                        </ThemedText>
                                      </Pressable>
                                      {splitFriends.map((friend) => (
                                        <Pressable
                                          key={friend.id}
                                          onPress={() =>
                                            updateSplitParticipant(index, {
                                              friendId: friend.id,
                                              friendName: '',
                                            })
                                          }
                                          className="rounded-full border px-3 py-2"
                                          style={{
                                            backgroundColor:
                                              participant.friendId === friend.id
                                                ? accentSurface
                                                : 'transparent',
                                            borderColor:
                                              participant.friendId === friend.id
                                                ? accent
                                                : theme.border,
                                          }}>
                                          <ThemedText
                                            className="text-xs font-bold"
                                            style={{
                                              color:
                                                participant.friendId === friend.id
                                                  ? accent
                                                  : theme.text,
                                            }}>
                                            {friend.name}
                                          </ThemedText>
                                        </Pressable>
                                      ))}
                                    </View>
                                  </ScrollView>
                                )}
                                {participant.friendId === null && (
                                  <TextInput
                                    value={participant.friendName}
                                    onChangeText={(text) =>
                                      updateSplitParticipant(index, { friendName: text })
                                    }
                                    placeholder="Friend name"
                                    placeholderTextColor="#9CA3AF"
                                    className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold dark:bg-gray-900"
                                    style={{ color: theme.text }}
                                  />
                                )}
                                <View className="mt-3 flex-row gap-3">
                                  <TextInput
                                    value={participant.shareAmount}
                                    onChangeText={(text) =>
                                      updateSplitParticipant(index, { shareAmount: text })
                                    }
                                    keyboardType="decimal-pad"
                                    placeholder="Amount"
                                    placeholderTextColor="#9CA3AF"
                                    className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold dark:bg-gray-900"
                                    style={{ color: theme.text }}
                                  />
                                  <Pressable
                                    onPress={() =>
                                      updateSplitParticipant(index, {
                                        direction:
                                          participant.direction === 'friend_owes_user'
                                            ? 'user_owes_friend'
                                            : 'friend_owes_user',
                                      })
                                    }
                                    className="justify-center rounded-2xl px-4"
                                    style={{ backgroundColor: accentSurface }}>
                                    <ThemedText
                                      className="text-xs font-black"
                                      style={{ color: accent }}>
                                      {participant.direction === 'friend_owes_user'
                                        ? 'Owes me'
                                        : 'I owe'}
                                    </ThemedText>
                                  </Pressable>
                                </View>
                              </View>
                            ))}
                          </View>

                          <Pressable
                            accessibilityRole="button"
                            onPress={addSplitParticipant}
                            className="flex-row items-center justify-center gap-2 rounded-2xl border py-3"
                            style={{ borderColor: theme.border }}>
                            <MaterialCommunityIcons name="plus" size={18} color={accent} />
                            <ThemedText className="text-sm font-black" style={{ color: accent }}>
                              Add friend share
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {mode !== 'quick-prompt' &&
                  !isEdit &&
                  (form.subscriptionEnabled || form.tag === 'Subscription') && (
                    <View className="px-5 mb-6">
                      <View
                        className="rounded-[24px] border p-3"
                        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-3">
                            <View
                              className="h-10 w-10 items-center justify-center rounded-2xl"
                              style={{ backgroundColor: accentSurface }}>
                              <MaterialCommunityIcons
                                name="calendar-sync-outline"
                                size={20}
                                color={accent}
                              />
                            </View>
                            <View>
                              <ThemedText
                                className="text-sm font-black"
                                style={{ color: theme.text }}>
                                Add subscription
                              </ThemedText>
                              <ThemedText className="text-xs text-gray-500">
                                Save recurring details with this payment.
                              </ThemedText>
                            </View>
                          </View>
                          <Pressable
                            accessibilityRole="switch"
                            accessibilityState={{ checked: form.subscriptionEnabled }}
                            onPress={() =>
                              setForm((prev) => ({
                                ...prev,
                                subscriptionEnabled: !prev.subscriptionEnabled,
                                subscriptionName:
                                  !prev.subscriptionEnabled && !prev.subscriptionName
                                    ? prev.merchant || prev.title
                                    : prev.subscriptionName,
                                subscriptionAmount:
                                  !prev.subscriptionEnabled && !prev.subscriptionAmount
                                    ? prev.amount
                                    : prev.subscriptionAmount,
                                subscriptionCategory:
                                  !prev.subscriptionEnabled && !prev.subscriptionCategory
                                    ? prev.category
                                    : prev.subscriptionCategory,
                              }))
                            }
                            className="h-8 w-14 justify-center rounded-full px-1"
                            style={{
                              backgroundColor: form.subscriptionEnabled ? accent : '#E5E7EB',
                            }}>
                            <View
                              className="h-6 w-6 rounded-full bg-white"
                              style={{
                                alignSelf: form.subscriptionEnabled ? 'flex-end' : 'flex-start',
                              }}
                            />
                          </Pressable>
                        </View>

                        {form.subscriptionEnabled && (
                          <View className="mt-5 gap-4">
                            <View className="flex-row gap-3">
                              <TextInput
                                value={form.subscriptionName}
                                onChangeText={(text) =>
                                  setForm((p) => ({ ...p, subscriptionName: text }))
                                }
                                placeholder="Subscription name"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                              <TextInput
                                value={form.subscriptionAmount}
                                onChangeText={(text) =>
                                  setForm((p) => ({
                                    ...p,
                                    subscriptionAmount: text.replace(/[^0-9.]/g, ''),
                                  }))
                                }
                                keyboardType="decimal-pad"
                                placeholder="Amount"
                                placeholderTextColor="#9CA3AF"
                                className="w-28 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                            </View>
                            <View className="flex-row gap-3">
                              <TextInput
                                value={form.subscriptionMerchant}
                                onChangeText={(text) =>
                                  setForm((p) => ({ ...p, subscriptionMerchant: text }))
                                }
                                placeholder="Merchant"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                              <TextInput
                                value={form.subscriptionCategory}
                                onChangeText={(text) =>
                                  setForm((p) => ({ ...p, subscriptionCategory: text }))
                                }
                                placeholder="Category"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                            </View>

                            <View>
                              <ThemedText className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Billing interval
                              </ThemedText>
                              <View className="flex-row flex-wrap gap-2">
                                {subscriptionIntervalOptions.map((interval) => (
                                  <Pressable
                                    key={interval}
                                    onPress={() =>
                                      setForm((p) => ({
                                        ...p,
                                        subscriptionBillingInterval: interval,
                                      }))
                                    }
                                    className="rounded-full border px-3 py-2"
                                    style={{
                                      backgroundColor:
                                        form.subscriptionBillingInterval === interval
                                          ? accentSurface
                                          : 'transparent',
                                      borderColor:
                                        form.subscriptionBillingInterval === interval
                                          ? accent
                                          : theme.border,
                                    }}>
                                    <ThemedText
                                      className="text-xs font-bold capitalize"
                                      style={{
                                        color:
                                          form.subscriptionBillingInterval === interval
                                            ? accent
                                            : theme.text,
                                      }}>
                                      {interval}
                                    </ThemedText>
                                  </Pressable>
                                ))}
                              </View>
                            </View>

                            <View className="flex-row gap-3">
                              <TextInput
                                value={form.subscriptionNextDueDate}
                                onChangeText={(text) =>
                                  setForm((p) => ({ ...p, subscriptionNextDueDate: text }))
                                }
                                placeholder="Next payment: YYYY-MM-DD"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                              <TextInput
                                value={form.subscriptionReminderDays}
                                onChangeText={(text) =>
                                  setForm((p) => ({
                                    ...p,
                                    subscriptionReminderDays: text.replace(/[^0-9]/g, ''),
                                  }))
                                }
                                keyboardType="number-pad"
                                placeholder="Reminder"
                                placeholderTextColor="#9CA3AF"
                                className="w-28 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                                style={{ color: theme.text }}
                              />
                            </View>

                            <Pressable
                              onPress={() =>
                                setForm((p) => ({
                                  ...p,
                                  subscriptionCancelBeforeDue: !p.subscriptionCancelBeforeDue,
                                }))
                              }
                              className="flex-row items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
                              <ThemedText className="text-sm font-bold" style={{ color: theme.text }}>
                                Remind me to cancel
                              </ThemedText>
                              <MaterialCommunityIcons
                                name={
                                  form.subscriptionCancelBeforeDue
                                    ? 'checkbox-marked-circle'
                                    : 'checkbox-blank-circle-outline'
                                }
                                size={22}
                                color={form.subscriptionCancelBeforeDue ? accent : '#9CA3AF'}
                              />
                            </Pressable>

                            <TextInput
                              multiline
                              value={form.subscriptionNotes}
                              onChangeText={(text) =>
                                setForm((p) => ({ ...p, subscriptionNotes: text }))
                              }
                              placeholder="Plan tier, cancellation link, or renewal notes"
                              placeholderTextColor="#9CA3AF"
                              className="min-h-[78px] rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold dark:bg-gray-800"
                              textAlignVertical="top"
                              style={{ color: theme.text }}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                <View className="px-5 mb-6">
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
                      className="w-full rounded-[24px] border p-3 flex-row items-center justify-between"
                      style={{
                        backgroundColor: categoryNeedsReview
                          ? colorScheme === 'dark'
                            ? theme.secondary
                            : '#FFFCF0'
                          : theme.card,
                        borderColor: categoryNeedsReview ? '#FDE68A' : theme.border,
                      }}>
                      <View className="flex-row items-center gap-4">
                        <View
                          className="h-10 w-10 items-center justify-center"
                          style={{
                            backgroundColor: categoryNeedsReview ? '#FEF3C7' : accentSurface,
                            borderRadius: themeTokens.icon.containerRadius,
                          }}>
                          <MaterialCommunityIcons
                            name="car-outline"
                            size={21}
                            color={categoryNeedsReview ? '#F59E0B' : accent}
                          />
                        </View>
                        <View>
                          <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">
                            Category
                          </ThemedText>
                          <ThemedText className="text-sm font-black" style={{ color: theme.text }}>
                            {form.category}
                          </ThemedText>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={24} color="#D1D5DB" />
                    </Pressable>
                  </View>
                </View>

                <View className="px-5 mb-4">
                  <Pressable
                    onPress={() => setIsMoreDetailsExpanded(!isMoreDetailsExpanded)}
                    className="flex-row items-center justify-between py-3 border-b border-gray-50">
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
                    <View className="mt-4 gap-4">
                      <View className="flex-row gap-4">
                        <View className="flex-1">
                          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">
                            Merchant
                          </ThemedText>
                          <View
                            className="rounded-[20px] border p-3 flex-row items-center gap-3 shadow-sm"
                            style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                            <View
                              className="h-8 w-8 rounded-xl items-center justify-center"
                              style={{ backgroundColor: detailIconSurface }}>
                              <MaterialCommunityIcons
                                name="storefront-outline"
                                size={16}
                                color={accent}
                              />
                            </View>
                            <TextInput
                              value={form.merchant}
                              onChangeText={(t) => setForm((p) => ({ ...p, merchant: t }))}
                              className="text-sm font-black flex-1 p-0"
                              placeholder="Merchant or store name"
                              placeholderTextColor={detailInputPlaceholderColor}
                              selectionColor={accent}
                              style={{ color: theme.text, minHeight: 24 }}
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
                              className="rounded-full border px-4 py-2"
                              style={{
                                backgroundColor: form.tag === tag ? accentSurface : theme.card,
                                borderColor: form.tag === tag ? accent : theme.border,
                              }}>
                              <ThemedText
                                className="text-xs font-bold"
                                style={{ color: form.tag === tag ? accent : '#6B7280' }}>
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
                          placeholderTextColor={detailInputPlaceholderColor}
                          value={form.notes}
                          onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))}
                          className="rounded-[20px] border px-4 py-3 text-sm font-bold min-h-[92px] shadow-sm"
                          textAlignVertical="top"
                          selectionColor={accent}
                          style={{
                            backgroundColor: theme.card,
                            borderColor: theme.border,
                            color: theme.text,
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View className="px-5 gap-3">
                  <Pressable
                    testID="entry-save-button"
                    onPress={handleConfirmEntry}
                    disabled={isSaving}
                    style={{ backgroundColor: accent }}
                    className="w-full py-4 rounded-[20px] flex-row items-center justify-center gap-2 shadow-lg">
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
                  {mode === 'audio' && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={requestClose}
                      className="w-full py-4 items-center justify-center active:opacity-50">
                      <ThemedText className="font-bold text-gray-500">Cancel</ThemedText>
                    </Pressable>
                  )}
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
          <AnimatedBottomSheet
            visible={isDatePickerVisible}
            onClose={() => setIsDatePickerVisible(false)}
            backdropOpacity={0.3}>
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
          </AnimatedBottomSheet>
        )}

        {/* Mode Picker */}
        <AnimatedBottomSheet
          visible={isModePickerVisible}
          onClose={() => setIsModePickerVisible(false)}
          backdropOpacity={0.3}>
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
                    className="flex-row items-center justify-between rounded-2xl border p-4"
                    style={{
                      backgroundColor:
                        form.mode === m
                          ? accentSurface
                          : colorScheme === 'dark'
                            ? theme.card
                            : '#F9FAFB',
                      borderColor: form.mode === m ? accent : 'transparent',
                    }}>
                    <ThemedText
                      className="font-bold"
                      style={{ color: form.mode === m ? accent : theme.text }}>
                      {m}
                    </ThemedText>
                    {form.mode === m && (
                      <MaterialCommunityIcons name="check" size={20} color={accent} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
        </AnimatedBottomSheet>

        {/* Category Picker */}
        <AnimatedBottomSheet
          visible={isCategoryPickerVisible}
          onClose={() => setIsCategoryPickerVisible(false)}
          backdropOpacity={0.3}>
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
                      className="w-[47%] items-center gap-2 rounded-3xl border p-4"
                      style={{
                        backgroundColor:
                          form.category === c
                            ? accentSurface
                            : colorScheme === 'dark'
                              ? theme.card
                              : '#F9FAFB',
                        borderColor: form.category === c ? accent : 'transparent',
                      }}>
                      <ThemedText
                        className="text-xs font-bold"
                        style={{ color: form.category === c ? accent : theme.text }}>
                        {c}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
        </AnimatedBottomSheet>

        {/* Account Picker */}
        <AnimatedBottomSheet
          visible={isAccountPickerVisible}
          onClose={() => setIsAccountPickerVisible(false)}
          backdropOpacity={0.3}>
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
        </AnimatedBottomSheet>

        <Modal
          transparent
          animationType="fade"
          visible={isDiscardDialogVisible}
          statusBarTranslucent
          onRequestClose={() => setIsDiscardDialogVisible(false)}>
          <View className="flex-1 items-center justify-center px-6">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep editing"
              className="absolute inset-0 bg-black/60"
              onPress={() => setIsDiscardDialogVisible(false)}
            />
            <View
              className="w-full max-w-sm items-center rounded-[32px] border p-6 shadow-2xl"
              style={{ backgroundColor: theme.background, borderColor: theme.border }}>
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: colorScheme === 'dark' ? '#3A2424' : '#FFF0EC' }}>
                <MaterialCommunityIcons name="delete-outline" size={27} color="#EF5B5B" />
              </View>
              <ThemedText
                className="mt-4 text-center text-xl font-black"
                style={{ color: theme.text }}>
                Discard this transaction?
              </ThemedText>
              <ThemedText className="mt-2 text-center text-sm leading-5 text-gray-500">
                Your transcribed draft and any changes you made will be lost.
              </ThemedText>

              <View className="mt-6 w-full gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsDiscardDialogVisible(false)}
                  className="w-full items-center justify-center rounded-2xl py-4"
                  style={{ backgroundColor: accent }}>
                  <ThemedText className="font-black text-white">Keep editing</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsDiscardDialogVisible(false);
                    onClose();
                  }}
                  className="w-full items-center justify-center rounded-2xl border py-4"
                  style={{ borderColor: theme.border }}>
                  <ThemedText className="font-black text-red-500">Discard transaction</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

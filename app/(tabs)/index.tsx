import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { HomeHeader } from '@/components/home/HomeHeader';
import { QuickPrompts } from '@/components/home/QuickPrompts';
import { TransactionItem } from '@/components/home/TransactionItem';
import { VoiceInputCard } from '@/components/home/VoiceInputCard';
import { CreditStatusCard } from '@/components/billing/CreditStatusCard';
import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Card, Screen, SectionHeader } from '@/components/ui/theme-primitives';
import { useAppSettingsStore } from '@/hooks/use-app-settings-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  fetchNewUnreadBudgetNotification,
  fetchUnreadBudgetNotificationIds,
  fetchUnreadNotificationCount,
} from '@/lib/notifications';
import {
  API_BASE_URL,
  formatApiDate,
  formatDateLabel,
  groupTransactionsBySection,
  loadTransactions,
  mapEntryToTransaction,
  normalizeDateLabel,
  parseDateLabel,
  toTitleCase,
} from '@/lib/transactions';
import { Transaction } from '@/types/transaction';
import { useAuthStore } from '@/hooks/use-auth-store';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '@/constants/Currency';
import {
  fetchAccounts as loadAccounts,
  getAccountTypeForPaymentMode,
  getAutoAccountPayloadForPaymentMode,
  getPreferredAccountForPaymentMode,
  saveAccount,
  type Account,
} from '@/lib/accounts';
import { createEntry } from '@/lib/entries';
import { formatDisplayTime } from '@/lib/datetime';
import { ParseApiError, parseEntryDraft, type ParseResponse } from '@/lib/parse';
import {
  fetchSplitFriends,
  fetchSplitGroups,
  type SplitFriend,
  type SplitGroup,
} from '@/lib/splits';
import { resolveSplitDraft } from '@/lib/split-draft';
import { createSubscription, type BillingInterval } from '@/lib/subscriptions';
import { notifyTransactionsChanged, subscribeTransactionsChanged } from '@/lib/transaction-events';
import { fetchBillingStatus, type BillingStatus } from '@/lib/billing';
import {
  TransactionFormModal,
  type AiReviewMetadata,
  type EntryForm,
} from '@/components/transactions/TransactionFormModal';

import '../../global.css';

const formatCompactCurrency = (amount: number) => {
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toFixed(0);
};

const billingIntervals: BillingInterval[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
];

const isBillingInterval = (value?: string | null): value is BillingInterval =>
  billingIntervals.includes(value as BillingInterval);

type CreditActionState = {
  title: string;
  message: string;
  actionLabel: string;
  action: 'upgrade' | 'login';
};

const addBillingInterval = (date: Date, interval: BillingInterval) => {
  const next = new Date(date);
  switch (interval) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return formatApiDate(next);
};

const inferNextSubscriptionDate = (
  paidDate: string | null | undefined,
  interval: BillingInterval | ''
) => {
  if (!paidDate || !interval) return '';
  const parsed = parseDateLabel(paidDate);
  return parsed ? addBillingInterval(parsed, interval) : '';
};

export default function HomeScreen() {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const isDark = themeTokens.mode === 'dark';
  const router = useRouter();
  const { token, user } = useAuthStore();
  const smartSorting = useAppSettingsStore((state) => state.smartSorting);
  const isStealthMode = !!user?.stealth_mode;

  const defaultForm = useMemo<EntryForm>(
    () => ({
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
    }),
    []
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [splitFriends, setSplitFriends] = useState<SplitFriend[]>([]);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const createBlankForm = useCallback(
    (): EntryForm => ({
      ...defaultForm,
      accountId: null,
      account: '',
      merchant: '',
      notes: '',
    }),
    [defaultForm]
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(defaultForm);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewMetadata | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [creditAction, setCreditAction] = useState<CreditActionState | null>(null);
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiInputSource, setAiInputSource] = useState<'text' | 'voice'>('text');
  const createIdempotencyKey = useRef<string | null>(null);
  const resumeDraftAfterAccounts = useRef(false);
  const saveConfirmationAnim = useRef(new Animated.Value(0)).current;

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<
    import('@/components/home/QuickPrompts').QuickPrompt | null
  >(null);
  const [modalMode, setModalMode] = useState<'audio' | 'manual' | 'quick-prompt'>('manual');

  const handleQuickPromptSelect = useCallback(
    (prompt: import('@/components/home/QuickPrompts').QuickPrompt) => {
      const blank = createBlankForm();
      const now = new Date();
      setAiReview(null);
      setForm({
        ...blank,
        title: prompt.title,
        amount: prompt.amount.toFixed(2),
        date: formatDateLabel(now),
        time: formatDisplayTime(now),
        mode: prompt.mode,
        category: prompt.category,
      });
      setModalMode('manual');
      setIsEditOpen(true);
    },
    [createBlankForm]
  );

  const handleAddPrompt = useCallback(() => {
    setEditingPrompt(null);
    setIsPromptModalOpen(true);
  }, []);

  const handleLongPressPrompt = useCallback(
    (prompt: import('@/components/home/QuickPrompts').QuickPrompt) => {
      setEditingPrompt(prompt);
      setIsPromptModalOpen(true);
    },
    []
  );

  const handleSavePrompt = async (
    formData: import('@/components/transactions/TransactionFormModal').EntryForm
  ) => {
    const id = editingPrompt?.id;
    const url = id ? `${API_BASE_URL}/v1/quick-prompts/${id}` : `${API_BASE_URL}/v1/quick-prompts`;
    const method = id ? 'PUT' : 'POST';

    const getIconForCategory = (cat: string) => {
      switch (cat.toLowerCase()) {
        case 'food & drinks':
          return 'coffee-outline';
        case 'travel':
          return 'train';
        case 'transport':
          return 'gas-station-outline';
        case 'shopping':
          return 'cart-outline';
        case 'bills':
          return 'file-document-outline';
        default:
          return 'lightning-bolt';
      }
    };

    const payload = {
      title: formData.title,
      amount: parseFloat(formData.amount),
      mode: formData.mode,
      category: formData.category,
      icon: getIconForCategory(formData.category),
    };

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      setIsPromptModalOpen(false);
      // We need to trigger a re-fetch in the QuickPrompts component.
      // In a real app we might use a global store or a key to force re-render.
      // For now, let's just use a simple key state.
      setQuickPromptKey((prev) => prev + 1);
    } else {
      throw new Error('Failed to save prompt');
    }
  };

  const handleDeletePrompt = async () => {
    if (!editingPrompt) return;
    const id = editingPrompt.id;
    const resp = await fetch(`${API_BASE_URL}/v1/quick-prompts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.ok) {
      setIsPromptModalOpen(false);
      setQuickPromptKey((prev) => prev + 1);
    } else {
      throw new Error('Failed to delete prompt');
    }
  };

  const [quickPromptKey, setQuickPromptKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const getInitialPromptData = (): Partial<
    import('@/components/transactions/TransactionFormModal').EntryForm
  > => {
    if (!editingPrompt)
      return {
        category: 'Food & Drinks',
        mode: 'Cash',
        type: 'Expense',
        date: formatDateLabel(new Date()),
      };
    return {
      title: editingPrompt.title,
      amount: editingPrompt.amount.toString(),
      mode: editingPrompt.mode,
      category: editingPrompt.category,
      type: 'Expense',
      date: formatDateLabel(new Date()),
    };
  };

  const fetchEntries = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setIsEntriesLoading(true);
      setEntriesError(null);
      try {
        const mapped = await loadTransactions(token);
        setTransactions(mapped);
      } catch (error) {
        setEntriesError(
          error instanceof Error ? error.message : 'Unable to load entries right now.'
        );
      } finally {
        if (!silent) setIsEntriesLoading(false);
      }
    },
    [token]
  );

  const fetchAccountOptions = useCallback(async () => {
    if (!token) {
      setAccounts([]);
      return;
    }
    try {
      setAccounts(await loadAccounts(token));
    } catch {
      setAccounts([]);
    }
  }, [token]);

  const fetchSplitOptions = useCallback(async () => {
    if (!token) {
      setSplitFriends([]);
      setSplitGroups([]);
      return;
    }
    try {
      const [friends, groups] = await Promise.all([
        fetchSplitFriends(token),
        fetchSplitGroups(token),
      ]);
      setSplitFriends(friends);
      setSplitGroups(groups);
    } catch {
      setSplitFriends([]);
      setSplitGroups([]);
    }
  }, [token]);

  const fetchCredits = useCallback(
    async (silent = false) => {
      if (!token) {
        setBillingStatus(null);
        return;
      }
      if (!silent) setIsBillingLoading(true);
      try {
        setBillingStatus(await fetchBillingStatus(token));
      } catch {
        setBillingStatus(null);
      } finally {
        if (!silent) setIsBillingLoading(false);
      }
    },
    [token]
  );

  const fetchNotificationCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount(token);
    setUnreadNotifications(count);
  }, [token]);

  const showNewBudgetAlert = useCallback(
    async (previousBudgetNotificationIds: Set<number>) => {
      if (!token) return;
      try {
        const notification = await fetchNewUnreadBudgetNotification(
          token,
          previousBudgetNotificationIds
        );
        if (!notification) return;
        Alert.alert(notification.title, notification.body, [
          { text: 'Later', style: 'cancel' },
          { text: 'View Budget Watch', onPress: () => router.push('/budgets') },
        ]);
        await fetchNotificationCount();
      } catch {
        // Budget alerts are also available in Notifications if the inline alert cannot load.
      }
    },
    [fetchNotificationCount, router, token]
  );

  useFocusEffect(
    useCallback(() => {
      if (resumeDraftAfterAccounts.current) {
        resumeDraftAfterAccounts.current = false;
        setIsEditOpen(true);
      }
      void fetchEntries();
      void fetchAccountOptions();
      void fetchSplitOptions();
      void fetchCredits();
      void fetchNotificationCount();
    }, [fetchAccountOptions, fetchCredits, fetchEntries, fetchNotificationCount, fetchSplitOptions])
  );

  useEffect(
    () =>
      subscribeTransactionsChanged(() => {
        void fetchEntries(true);
      }),
    [fetchEntries]
  );

  const sections = useMemo(() => groupTransactionsBySection(transactions), [transactions]);
  const hasTransactions = sections.length > 0;

  const ensureMicPermission = useCallback(async () => {
    if (permissionResponse?.status === 'granted') {
      return true;
    }
    const permission = await requestPermission?.();
    return permission?.status === 'granted';
  }, [permissionResponse?.status, requestPermission]);

  const startRecording = useCallback(async () => {
    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      setErrorMessage('Microphone permission is required to record audio.');
      return;
    }
    try {
      setErrorMessage(null);
      setRecordedUri(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const recordingObject = new Audio.Recording();
      await recordingObject.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingObject.startAsync();
      setRecording(recordingObject);
      setIsRecording(true);
    } catch {
      setErrorMessage('Unable to start recording. Please try again.');
      setRecording(null);
      setIsRecording(false);
    }
  }, [ensureMicPermission]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
    } catch {
      setErrorMessage('Unable to stop recording. Please try again.');
    } finally {
      setRecording(null);
      setIsRecording(false);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        // Ignore
      }
    }
  }, [recording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  useEffect(() => {
    if (!saveConfirmation) return undefined;
    saveConfirmationAnim.stopAnimation();
    saveConfirmationAnim.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(saveConfirmationAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(saveConfirmationAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        setSaveConfirmation(null);
      }
    });
    return () => animation.stop();
  }, [saveConfirmation, saveConfirmationAnim]);

  const handleClearRecording = useCallback(() => {
    setRecordedUri(null);
    setInputText('');
    setErrorMessage(null);
    setCreditAction(null);
  }, []);

  const handleOpenManualEntry = useCallback(() => {
    setAiReview(null);
    setAiSourceText('');
    setAiInputSource('text');
    createIdempotencyKey.current = null;
    setForm(createBlankForm());
    setModalMode('manual');
    setIsEditOpen(true);
  }, [createBlankForm]);

  const ensureAccountForEntry = useCallback(
    async (formData: EntryForm) => {
      const requiredType = getAccountTypeForPaymentMode(formData.mode);
      const selectedAccount =
        formData.accountId === null
          ? null
          : (accounts.find((account) => account.id === formData.accountId) ?? null);
      if (
        selectedAccount &&
        (!requiredType || selectedAccount.type?.toLowerCase() === requiredType)
      ) {
        return selectedAccount;
      }

      const preferredAccount = getPreferredAccountForPaymentMode(accounts, formData.mode);
      if (preferredAccount) {
        return preferredAccount;
      }

      const autoAccountPayload = getAutoAccountPayloadForPaymentMode(formData.mode);
      if (!autoAccountPayload) {
        throw new Error('Please select an account.');
      }
      if (!token) {
        throw new Error('Please sign in again before saving this transaction.');
      }

      const createdAccount = await saveAccount(token, autoAccountPayload);
      setAccounts((current) => [
        createdAccount,
        ...current.filter((account) => account.id !== createdAccount.id),
      ]);
      return createdAccount;
    },
    [accounts, token]
  );

  const handleConfirmEntry = useCallback(
    async (formData: EntryForm) => {
      try {
        const resolvedAccount = await ensureAccountForEntry(formData);
        const parsedDate = parseDateLabel(formData.date);
        const trimmedTag = formData.tag.trim();
        if (!createIdempotencyKey.current) {
          createIdempotencyKey.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        if (!token) {
          throw new Error('Please sign in again before saving this transaction.');
        }
        const splitPayload =
          formData.splitEnabled && formData.type === 'Expense'
              ? {
                  group_id: formData.splitGroupId,
                  group_name: formData.splitGroupId ? '' : formData.splitGroupName.trim(),
                  notes: formData.notes.trim(),
                  participants: formData.splitParticipants.map((participant) => ({
                  ...(participant.friendId
                    ? { friend_id: participant.friendId }
                    : { friend: { name: participant.friendName.trim() } }),
                  share_amount: participant.shareAmount.trim(),
                  direction: participant.direction,
                })),
              }
            : undefined;

        const budgetNotificationIds =
          formData.type === 'Expense' && token
            ? await fetchUnreadBudgetNotificationIds(token).catch(() => new Set<number>())
            : new Set<number>();

        const createdEntry = await createEntry(
          token,
          {
            amount: formData.amount.trim(),
            currency: formData.currency || DEFAULT_CURRENCY,
            source: modalMode === 'audio' ? aiInputSource : 'manual',
            source_text: modalMode === 'audio' ? aiSourceText : '',
            account_id: resolvedAccount.id,
            type: formData.type.toLowerCase(),
            mode: formData.mode,
            category: formData.category,
            notes: formData.notes.trim(),
            date: parsedDate ? formatApiDate(parsedDate) : formData.date,
            tag: trimmedTag.length > 0 ? trimmedTag : null,
            merchant: formData.merchant.trim(),
            title: formData.title.trim() || 'Untitled Transaction',
            time: formData.time,
            ...(splitPayload ? { split: splitPayload } : {}),
          },
          createIdempotencyKey.current
        );
        if (formData.subscriptionEnabled && formData.subscriptionBillingInterval) {
          await createSubscription(token, {
            name: formData.subscriptionName.trim(),
            merchant: formData.subscriptionMerchant.trim() || formData.merchant.trim(),
            category: formData.subscriptionCategory.trim() || formData.category,
            amount: Number(formData.subscriptionAmount || formData.amount),
            billing_interval: formData.subscriptionBillingInterval,
            next_due_date: formData.subscriptionNextDueDate.trim(),
            last_charged_date: parsedDate ? formatApiDate(parsedDate) : undefined,
            status: 'active',
            reminder_days: Number(formData.subscriptionReminderDays || 0),
            cancel_before_due: formData.subscriptionCancelBeforeDue,
            notes: formData.subscriptionNotes.trim(),
            account_id: resolvedAccount.id,
          });
        }
        const createdTransaction = mapEntryToTransaction(createdEntry);
        setTransactions((current) => [
          createdTransaction,
          ...current.filter((transaction) => transaction.id !== createdTransaction.id),
        ]);
        setSaveConfirmation(formData.subscriptionEnabled ? 'Saved with subscription' : 'Saved');

        createIdempotencyKey.current = null;
        setForm(createBlankForm());
        setAiSourceText('');
        setIsEditOpen(false);
        notifyTransactionsChanged();
        if (formData.type === 'Expense') {
          void showNewBudgetAlert(budgetNotificationIds);
        }
        void fetchSplitOptions();
      } catch (error) {
        const saveError =
          error instanceof Error
            ? error
            : new Error('Unable to save your entry. Please try again.');
        throw saveError;
      }
    },
    [
      aiInputSource,
      aiSourceText,
      createBlankForm,
      ensureAccountForEntry,
      fetchSplitOptions,
      modalMode,
      showNewBudgetAlert,
      token,
    ]
  );

  const handleSubmitPrompt = useCallback(async () => {
    if (isSubmitting) return;
    const trimmed = inputText.trim();
    if (!trimmed && !recordedUri) {
      setErrorMessage('Please type or record your expense first.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setCreditAction(null);
    try {
      let audio:
        | {
            uri: string;
            name: string;
            type: string;
          }
        | undefined;
      if (trimmed) {
        audio = undefined;
      } else if (recordedUri) {
        const extension = recordedUri.split('.').pop();
        const fileName = `recording.${extension ?? 'm4a'}`;
        audio = {
          uri: recordedUri,
          name: fileName,
          type: extension === 'wav' ? 'audio/wav' : 'audio/m4a',
        };
      }
      const data: ParseResponse = await parseEntryDraft({ token, hintText: trimmed, audio });
      void fetchCredits(true);
      createIdempotencyKey.current = null;
      setAiSourceText(data.source_text ?? trimmed);
      setAiInputSource(recordedUri ? 'voice' : 'text');
      setAiReview({
        confidence: data.confidence,
        needsConfirmation: data.needs_confirmation,
        missingFields: smartSorting
          ? data.missing_fields
          : Array.from(
              new Set([...(data.missing_fields ?? []), 'title', 'mode', 'category', 'tag'])
            ),
        clarifications: data.clarifications,
        smartSortingDisabled: !smartSorting,
      });
      setForm((prev) => {
        const missing = new Set(data.missing_fields ?? []);
        const formattedDate =
          missing.has('date') || !data.date ? '' : normalizeDateLabel(data.date, '');
        const tagValue = data.tag ?? data.tags?.[0] ?? '';
        const newType = missing.has('type') ? '' : (toTitleCase(data.type) ?? '');
        const splitDraft = resolveSplitDraft(data, splitFriends, splitGroups);
        const subscriptionCandidate = data.subscription_candidate;
        const subscriptionInterval = isBillingInterval(subscriptionCandidate?.billing_interval)
          ? subscriptionCandidate.billing_interval
          : '';
        const subscriptionPaidDate = subscriptionCandidate?.last_charged_date ?? data.date;
        const inferredNextDueDate =
          subscriptionCandidate?.next_due_date ??
          inferNextSubscriptionDate(subscriptionPaidDate, subscriptionInterval);
        return {
          ...prev,
          title: smartSorting && !missing.has('title') ? (data.title ?? '') : '',
          amount: missing.has('amount') || data.amount == null ? '' : data.amount.toFixed(2),
          currency: data.currency ?? prev.currency,
          time: data.time ?? prev.time,
          type: newType,
          mode: smartSorting && !missing.has('mode') ? (data.mode ?? '') : '',
          category: smartSorting && !missing.has('category') ? (data.category ?? '') : '',
          merchant: data.merchant ?? '',
          notes: data.note ?? '',
          date: formattedDate,
          tag: smartSorting && tagValue ? (toTitleCase(tagValue) ?? '') : '',
          splitEnabled: splitDraft.splitEnabled,
          splitGroupId: splitDraft.splitGroupId,
          splitGroupName: splitDraft.splitGroupName,
          splitParticipants: splitDraft.splitParticipants,
          subscriptionEnabled: Boolean(subscriptionCandidate),
          subscriptionName: subscriptionCandidate?.name ?? data.merchant ?? data.title ?? '',
          subscriptionMerchant: subscriptionCandidate?.merchant ?? data.merchant ?? '',
          subscriptionCategory: subscriptionCandidate?.category ?? data.category ?? '',
          subscriptionAmount:
            subscriptionCandidate?.amount != null
              ? subscriptionCandidate.amount.toFixed(2)
              : data.amount != null
                ? data.amount.toFixed(2)
                : '',
          subscriptionBillingInterval: subscriptionInterval,
          subscriptionNextDueDate: inferredNextDueDate,
          subscriptionReminderDays:
            subscriptionCandidate?.reminder_days != null
              ? String(subscriptionCandidate.reminder_days)
              : '3',
          subscriptionCancelBeforeDue: Boolean(subscriptionCandidate?.cancel_before_due),
          subscriptionNotes: subscriptionCandidate?.notes ?? '',
        };
      });
      setInputText('');
      setRecordedUri(null);
      setModalMode('audio');
      setIsEditOpen(true);
    } catch (error) {
      if (error instanceof ParseApiError) {
        if (error.code === 'insufficient_ai_credits') {
          setCreditAction({
            title: 'AI credits are low',
            message: `This capture needs ${error.requiredCredits ?? 5} credits. You have ${error.availableCredits ?? 0} available.`,
            actionLabel: user?.is_guest ? 'Create account' : 'View plans',
            action: user?.is_guest ? 'login' : 'upgrade',
          });
          void fetchCredits(true);
          return;
        }
        if (error.code === 'daily_ai_limit_reached') {
          setCreditAction({
            title: 'Daily AI limit reached',
            message: `You used ${error.usedToday ?? billingStatus?.credits.daily_credits_used ?? 0} of ${error.dailyLimit ?? billingStatus?.credits.daily_limit ?? 0} credits today.`,
            actionLabel: 'View plans',
            action: 'upgrade',
          });
          void fetchCredits(true);
          return;
        }
      }
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong while parsing.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    billingStatus?.credits.daily_credits_used,
    billingStatus?.credits.daily_limit,
    fetchCredits,
    inputText,
    isSubmitting,
    recordedUri,
    smartSorting,
    splitFriends,
    splitGroups,
    token,
    user?.is_guest,
  ]);

  const renderRecentActivity = () => {
    if (isEntriesLoading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator color={theme.accent} />
          <ThemedText className="mt-2 text-gray-400 font-medium">Loading activity...</ThemedText>
        </View>
      );
    }

    if (entriesError) {
      return (
        <StateView
          icon="wifi-off"
          title="Activity did not load"
          message={entriesError}
          actionLabel="Try again"
          onAction={() => void fetchEntries()}
        />
      );
    }

    if (!hasTransactions) {
      return (
        <StateView
          icon="receipt-text-plus-outline"
          title="No activity yet"
          message="Record, type, or add your first transaction to start building your money story."
          actionLabel="Add"
          onAction={handleOpenManualEntry}
        />
      );
    }

    const recentTransactions = transactions.slice(0, 5);
    const groupedRecentTransactions = groupTransactionsBySection(recentTransactions);
    const todayCount = transactions.filter(
      (item) => item.section === 'Today' || item.dateLabel === 'Today'
    ).length;
    const recentExpenseTotal = recentTransactions.reduce(
      (sum, item) => (item.entryType === 'income' ? sum : sum + Math.abs(item.amount)),
      0
    );

    return (
      <View>
        <SectionHeader
          title="Recent Activity"
          actionLabel="See All"
          onAction={() => router.push('/transactions')}
        />

        <View className="px-6">
          {groupedRecentTransactions.map((group, groupIndex) => (
            <Card
              key={group.title}
              compact
              style={{
                overflow: 'hidden',
                padding: 0,
                marginBottom:
                  groupIndex === groupedRecentTransactions.length - 1 ? 0 : themeTokens.spacing.md,
              }}>
              <View
                style={{
                  paddingHorizontal: themeTokens.spacing.lg,
                  paddingTop: themeTokens.spacing.md,
                  paddingBottom: themeTokens.spacing.xs,
                }}>
                <ThemedText
                  variant="micro"
                  style={{
                    color: isDark ? 'rgba(255,255,255,0.5)' : '#9A9697',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                  {group.title}
                </ThemedText>
              </View>
              {group.data.map((item, index) => {
                const isLastInSection = index === group.data.length - 1;
                return (
                  <TransactionItem
                    key={item.id}
                    title={item.name}
                    icon={item.icon}
                    category={item.category}
                    subtitle={item.accountName ?? item.mode ?? ''}
                    amount={Math.abs(item.amount).toFixed(2)}
                    maskAmount={isStealthMode}
                    date={item.timeLabel ?? item.dateLabel ?? ''}
                    color={item.color}
                    bgColor={item.bgColor}
                    isIncome={item.entryType === 'income'}
                    variant="list"
                    showDivider={!isLastInSection}
                    onPress={() => {
                      router.push({
                        pathname: '/entry/[id]',
                        params: {
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          amount: Math.abs(item.amount).toFixed(2),
                          entryType: item.entryType ?? 'expense',
                          section: item.section,
                          mode: item.mode ?? '',
                          notes: item.notes ?? '',
                          merchant: item.merchant ?? '',
                          dateLabel: item.dateLabel ?? '',
                          rawDate: item.rawDate ?? '',
                          tag: item.tag ?? '',
                        },
                      });
                    }}
                  />
                );
              })}
            </Card>
          ))}
          <View
            style={{
              paddingHorizontal: themeTokens.spacing.lg,
              paddingTop: themeTokens.spacing.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <ThemedText variant="captionStrong" style={{ color: '#A7A1A3' }}>
              {recentTransactions.length} latest
            </ThemedText>
            <ThemedText variant="captionStrong" style={{ color: '#A7A1A3' }}>
              {todayCount} today
            </ThemedText>
            <ThemedText variant="captionStrong" style={{ color: '#A7A1A3' }}>
              {isStealthMode
                ? `${CURRENCY_SYMBOL}•••• out`
                : `${CURRENCY_SYMBOL}${formatCompactCurrency(recentExpenseTotal)} out`}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <HomeHeader
          unreadCount={unreadNotifications}
          onNotificationsPress={() => router.push('/notifications')}
        />

        <View className="px-6 pb-4">
          <ThemedText className="text-xs text-gray-500 font-medium text-center">
            Speak naturally. Finnri will organize it.
          </ThemedText>
        </View>

        <View style={{ marginBottom: themeTokens.spacing.md }}>
          <CreditStatusCard
            credits={billingStatus?.credits ?? null}
            loading={isBillingLoading}
            onPress={() => router.push('/billing')}
          />
        </View>

        <VoiceInputCard
          onMicPress={handleToggleRecording}
          isRecording={isRecording}
          hasRecording={!!recordedUri}
          inputText={inputText}
          onChangeText={setInputText}
          onProcess={handleSubmitPrompt}
          onClear={handleClearRecording}
          isProcessing={isSubmitting}
          isTextInputVisible={isTextInputVisible}
          onToggleTextInput={() => setIsTextInputVisible((current) => !current)}
          dailyCreditsRemaining={billingStatus?.credits.daily_credits_remaining ?? null}
        />

        <QuickPrompts
          key={`quick-prompts-${quickPromptKey}`}
          onSelect={handleQuickPromptSelect}
          onAdd={handleAddPrompt}
          onLongPress={handleLongPressPrompt}
        />

        {errorMessage && (
          <View className="mx-6 mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
            <ThemedText className="text-red-500 dark:text-red-400 text-center font-bold">
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {creditAction && (
          <View
            className="mx-6 mb-6 rounded-2xl border p-4"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF8F4',
              borderColor: themeTokens.colors.border,
            }}>
            <View className="flex-row items-start gap-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: themeTokens.colors.secondary }}>
                <MaterialCommunityIcons
                  name="creation"
                  size={18}
                  color={themeTokens.colors.accent}
                />
              </View>
              <View className="min-w-0 flex-1">
                <ThemedText className="font-bold" style={{ color: themeTokens.colors.text }}>
                  {creditAction.title}
                </ThemedText>
                <ThemedText
                  className="mt-1 text-xs"
                  style={{ color: `${themeTokens.colors.text}99` }}>
                  {creditAction.message}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(creditAction.action === 'login' ? '/auth?mode=link' : '/billing')
                  }
                  className="mt-3 self-start rounded-full px-4 py-2"
                  style={{ backgroundColor: themeTokens.colors.accent }}>
                  <ThemedText className="text-xs font-bold text-white">
                    {creditAction.actionLabel}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {renderRecentActivity()}

        <View className="h-32" />
      </ScrollView>

      {hasTransactions && (
        <Pressable
          accessibilityRole="button"
          onPress={handleOpenManualEntry}
          style={[{ backgroundColor: theme.accent }, themeTokens.shadows.soft]}
          className="h-16 w-16 rounded-full items-center justify-center absolute bottom-10 right-6 elevation-5">
          <MaterialCommunityIcons name="plus" size={32} color="white" />
        </Pressable>
      )}

      {saveConfirmation && (
        <Animated.View
          accessibilityLiveRegion="polite"
          className="absolute bottom-28 self-center z-50 flex-row items-center gap-2 rounded-full px-3 py-2 shadow-md"
          style={{
            backgroundColor: theme.accent,
            opacity: saveConfirmationAnim,
            transform: [
              {
                translateY: saveConfirmationAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
          pointerEvents="none">
          <MaterialCommunityIcons name="check" size={15} color="white" />
          <ThemedText className="text-xs font-bold text-white">{saveConfirmation}</ThemedText>
        </Animated.View>
      )}

      <TransactionFormModal
        visible={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={form}
        onSave={handleConfirmEntry}
        mode={modalMode}
        aiReview={aiReview}
        accounts={accounts}
        splitFriends={splitFriends}
        splitGroups={splitGroups}
        onDraftChange={setForm}
        onManageAccounts={() => {
          resumeDraftAfterAccounts.current = true;
          setIsEditOpen(false);
          router.push('/accounts');
        }}
      />
      <TransactionFormModal
        visible={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        initialData={getInitialPromptData()}
        onSave={handleSavePrompt}
        onDelete={editingPrompt ? handleDeletePrompt : undefined}
        isEdit={!!editingPrompt}
        mode="quick-prompt"
      />
    </Screen>
  );
}

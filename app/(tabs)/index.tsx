import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, View } from 'react-native';

import { HomeHeader } from '@/components/home/HomeHeader';
import { QuickPrompts } from '@/components/home/QuickPrompts';
import { TransactionItem } from '@/components/home/TransactionItem';
import { VoiceInputCard } from '@/components/home/VoiceInputCard';
import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Card, Screen, SectionHeader } from '@/components/ui/theme-primitives';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fetchUnreadNotificationCount } from '@/lib/notifications';
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
import { parseEntryDraft, type ParseResponse } from '@/lib/parse';
import { notifyTransactionsChanged, subscribeTransactionsChanged } from '@/lib/transaction-events';
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

export default function HomeScreen() {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const isDark = themeTokens.mode === 'dark';
  const router = useRouter();
  const { token } = useAuthStore();

  const defaultForm = useMemo(
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
    }),
    []
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
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
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiInputSource, setAiInputSource] = useState<'text' | 'voice'>('text');
  const createIdempotencyKey = useRef<string | null>(null);
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

  const fetchNotificationCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount(token);
    setUnreadNotifications(count);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void fetchEntries();
      void fetchAccountOptions();
      void fetchNotificationCount();
    }, [fetchAccountOptions, fetchEntries, fetchNotificationCount])
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
          },
          createIdempotencyKey.current
        );
        const createdTransaction = mapEntryToTransaction(createdEntry);
        setTransactions((current) => [
          createdTransaction,
          ...current.filter((transaction) => transaction.id !== createdTransaction.id),
        ]);
        setSaveConfirmation('Saved');

        createIdempotencyKey.current = null;
        setForm(createBlankForm());
        setAiSourceText('');
        setIsEditOpen(false);
        notifyTransactionsChanged();
      } catch (error) {
        const saveError =
          error instanceof Error
            ? error
            : new Error('Unable to save your entry. Please try again.');
        throw saveError;
      }
    },
    [aiInputSource, aiSourceText, createBlankForm, ensureAccountForEntry, modalMode, token]
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
      createIdempotencyKey.current = null;
      setAiSourceText(data.source_text ?? trimmed);
      setAiInputSource(recordedUri ? 'voice' : 'text');
      setAiReview({
        confidence: data.confidence,
        needsConfirmation: data.needs_confirmation,
        missingFields: data.missing_fields,
        clarifications: data.clarifications,
      });
      setForm((prev) => {
        const missing = new Set(data.missing_fields ?? []);
        const formattedDate =
          missing.has('date') || !data.date ? '' : normalizeDateLabel(data.date, '');
        const tagValue = data.tag ?? '';
        const newType = missing.has('type') ? '' : (toTitleCase(data.type) ?? '');
        return {
          ...prev,
          title: missing.has('title') ? '' : (data.title ?? ''),
          amount: missing.has('amount') || data.amount == null ? '' : data.amount.toFixed(2),
          currency: data.currency ?? prev.currency,
          time: data.time ?? prev.time,
          type: newType,
          mode: missing.has('mode') ? '' : (data.mode ?? ''),
          category: missing.has('category') ? '' : (data.category ?? ''),
          merchant: data.merchant ?? '',
          notes: data.note ?? '',
          date: formattedDate,
          tag: tagValue ? (toTitleCase(tagValue) ?? '') : '',
        };
      });
      setInputText('');
      setRecordedUri(null);
      setModalMode('audio');
      setIsEditOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong while parsing.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [inputText, isSubmitting, recordedUri, token]);

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
          actionLabel="Add manually"
          onAction={handleOpenManualEntry}
        />
      );
    }

    const recentTransactions = transactions.slice(0, 5);
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
          <Card compact style={{ overflow: 'hidden', padding: 0 }}>
            {recentTransactions.map((item, index) => (
              <TransactionItem
                key={item.id}
                title={item.name}
                icon={item.icon}
                category={item.category}
                subtitle={item.accountName ?? item.mode ?? ''}
                amount={Math.abs(item.amount).toFixed(2)}
                date={item.section}
                color={item.color}
                bgColor={item.bgColor}
                isIncome={item.entryType === 'income'}
                variant="list"
                showDivider={index < recentTransactions.length - 1}
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
            ))}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(45,45,45,0.06)',
                paddingHorizontal: themeTokens.spacing.lg,
                paddingVertical: themeTokens.spacing.md,
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
                {CURRENCY_SYMBOL}
                {formatCompactCurrency(recentExpenseTotal)} out
              </ThemedText>
            </View>
          </Card>
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

        {renderRecentActivity()}

        <View className="h-32" />
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={handleOpenManualEntry}
        style={[{ backgroundColor: theme.accent }, themeTokens.shadows.soft]}
        className="h-16 w-16 rounded-full items-center justify-center absolute bottom-10 right-6 elevation-5">
        <MaterialCommunityIcons name="plus" size={32} color="white" />
      </Pressable>

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
        onManageAccounts={() => router.push('/accounts')}
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

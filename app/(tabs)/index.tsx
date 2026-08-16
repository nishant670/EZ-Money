import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useRouter, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Easing,
  Pressable,
  View,
} from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { AnswerCard } from '@/components/home/AnswerCard';
import {
  CAPTURE_COLLAPSED_HEIGHT,
  CollapsibleCapture,
} from '@/components/home/CollapsibleCapture';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MonthStrip } from '@/components/home/MonthStrip';
import { QuickPrompts } from '@/components/home/QuickPrompts';
import { TransactionItem } from '@/components/home/TransactionItem';
import { VoiceInputCard } from '@/components/home/VoiceInputCard';
import { CreditStatusCard } from '@/components/billing/CreditStatusCard';
import { GuestUpgradePrompt } from '@/components/home/GuestUpgradePrompt';
import { ThemedText } from '@/components/themed-text';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SkeletonFrame, SkeletonRows } from '@/components/ui/Skeleton';
import { StateView } from '@/components/ui/StateView';
import { Card, Screen, SectionHeader } from '@/components/ui/theme-primitives';
import { useAppSettingsStore } from '@/hooks/use-app-settings-store';
import { useMotion } from '@/hooks/use-motion';
import { encodeFrame } from '@/hooks/use-shared-element';
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
import { DEFAULT_CURRENCY } from '@/constants/Currency';
import { Motion } from '@/constants/theme';
import { DEFAULT_CATEGORY } from '@/lib/categories';
import {
  isGuestUpgradePromptSnoozed,
  shouldShowGuestUpgradePrompt,
  snoozeGuestUpgradePrompt,
} from '@/lib/guest-upgrade';
import {
  fetchAccounts as loadAccounts,
  getAccountTypeForPaymentMode,
  getAutoAccountPayloadForPaymentMode,
  getPreferredAccountForPaymentMode,
  saveAccount,
  type Account,
} from '@/lib/accounts';
import { createEntry } from '@/lib/entries';
import { haptics } from '@/lib/haptics';
import { resolveAttachmentForSave } from '@/lib/uploads';
import { formatTime, toApiTime } from '@/lib/datetime';
import { toAmountInputValue, toAmountString } from '@/lib/money';
import {
  isParseAnswer,
  looksLikeQuestion,
  ParseApiError,
  parseEntryDraft,
  type LedgerAnswer,
  type ParseResponse,
} from '@/lib/parse';
import {
  fetchSplitFriends,
  fetchSplitGroups,
  type SplitFriend,
  type SplitGroup,
} from '@/lib/splits';
import { resolveSplitDraft } from '@/lib/split-draft';
import { fetchDashboard, type DashboardResponse } from '@/lib/insights';
import {
  confirmSubscriptionOccurrence,
  createSubscription,
  fetchSubscriptionOccurrences,
  revertSubscriptionOccurrence,
  syncSubscriptionAutomation,
  type BillingInterval,
  type SubscriptionOccurrence,
} from '@/lib/subscriptions';
import { inferNextSubscriptionDate } from '@/lib/subscription-schedule';
import { notifyTransactionsChanged, subscribeTransactionsChanged } from '@/lib/transaction-events';
import { fetchBillingStatus, type BillingStatus } from '@/lib/billing';
import { getFriendlyErrorMessage } from '@/lib/api-error';
import {
  TransactionFormModal,
  type AiReviewMetadata,
  type EntryForm,
} from '@/components/transactions/TransactionFormModal';

/**
 * The FAB floats above the scroll view, so anything that scrolls under it has
 * to stop short of its footprint. Its geometry is written here once and nowhere
 * else: the button reads these, and so do the list's bottom padding and the
 * save toast that has to clear it. Change FAB_SIZE and all three follow.
 */
const FAB_SIZE = 64;
const FAB_BOTTOM_OFFSET = 40;
const FAB_RIGHT_OFFSET = 24;
/** The button's full footprint, plus a gap of air so the last row breathes. */
const LIST_BOTTOM_PADDING = FAB_SIZE + FAB_BOTTOM_OFFSET + 24;

/**
 * How many entries the feed needs before the capture card is allowed to
 * collapse into its pill.
 *
 * The collapse trades the card for space to read the feed in, and on an empty
 * or nearly-empty Home there is no feed to make room for — the trade is all
 * cost. Worse, it half-happened: the content was long enough to scroll a
 * little and nowhere near long enough to scroll the ~230px the collapse spans,
 * so the card stopped mid-crossfade and left a ghost pill at 50% opacity under
 * a band of dead space, with the scroll already at its end and no way to
 * finish. `minHeight` below keeps that from happening at any length; this
 * keeps the animation from running at all when it has nothing to buy.
 */
const MIN_ENTRIES_FOR_COLLAPSE = 3;
/** Just above the FAB, so the toast never lands on top of it. */
const SAVE_TOAST_BOTTOM_OFFSET = FAB_BOTTOM_OFFSET + FAB_SIZE + 8;

/** Roughly how long ScrollView's animated scrollTo takes to settle. */
const CAPTURE_EXPAND_MS = 260;

/**
 * How long a freshly saved row stays marked as new. Covers its entrance plus
 * the accent tint fading out, with enough slack that a slow frame cannot cut
 * the highlight off mid-fade.
 */
const NEW_ROW_HIGHLIGHT_MS = 1200;

/**
 * `RecordingPresets.HIGH_QUALITY` does not enable metering, so `getStatus()`
 * returned no `metering` at all and the recording rings had nothing to react
 * to — they were decorative because the level was never asked for. Spread into
 * a module-level constant rather than built inline: a fresh options object on
 * every render would rebuild the recorder underneath an in-progress recording.
 */
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

/**
 * How long the save toast holds once it has arrived. A reading time, not a
 * motion duration — there is no `Motion` token for it because it is not a
 * curve, and shortening it under reduced motion would make the confirmation
 * harder to read rather than calmer.
 */
const SAVE_TOAST_DWELL_MS = 2200;

/** Legacy `Animated` needs the curve as a plain function; see AnimatedBottomSheet. */
const TOAST_IN_EASING = Easing.bezier(...Motion.ease.standard);
const TOAST_OUT_EASING = Easing.bezier(...Motion.ease.exit);

const billingIntervals: BillingInterval[] = [
  'daily',
  'business_daily',
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
      // S2 left this behind: 'Food' is a legacy alias, and the amount-first
      // sheet shows the seeded category on a chip and saves it as the title.
      category: DEFAULT_CATEGORY,
      date: formatDateLabel(new Date()),
      time: formatTime(new Date()) ?? '',
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
      subscriptionCancelOnDate: '',
      subscriptionAutopay: false,
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
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [monthDashboard, setMonthDashboard] = useState<DashboardResponse | null>(null);
  const [isMonthLoading, setIsMonthLoading] = useState(true);
  // Measured, not assumed: the pinned block's two halves tell the feed how far
  // to pad itself, and the capture card's height changes with its state.
  const [pinnedTopHeight, setPinnedTopHeight] = useState(0);
  const [captureExpandedHeight, setCaptureExpandedHeight] = useState(0);
  // The scroll view's own height, so the content can be padded to guarantee
  // the collapse has somewhere to run. See `contentContainerStyle` below.
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Re-tapping the Home tab returns the feed to the top. The reanimated ref
  // holds the same ScrollView instance react-navigation's helper looks for.
  useScrollToTop(scrollRef as unknown as React.RefObject<Animated.ScrollView>);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewMetadata | null>(null);
  /**
   * The sheet is open on an empty draft while the parse is in flight. Two to
   * four seconds against the screen the user was already looking at is a wait;
   * the same seconds inside the sheet the answer will appear in is progress.
   */
  const [isParsing, setIsParsing] = useState(false);
  /**
   * The other direction of the capture field: the answer to a question about
   * money already recorded. It lives on Home rather than in a sheet because it
   * is a reply, not a form — there is nothing to confirm and nothing to save.
   */
  const [answer, setAnswer] = useState<LedgerAnswer | null>(null);
  const [answerSourceText, setAnswerSourceText] = useState('');
  /**
   * Set while a question is in flight, so the wait has somewhere to happen that
   * is not the draft sheet. Only ever set for typed text that reads as a
   * question; a capture never sees it.
   */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  /**
   * The row that was just written, so the feed can say which one is new. Cleared
   * on a timer rather than left set, or the highlight would come back every time
   * the list re-rendered for an unrelated reason.
   */
  const [newTransactionId, setNewTransactionId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [creditAction, setCreditAction] = useState<CreditActionState | null>(null);
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiInputSource, setAiInputSource] = useState<'text' | 'voice'>('text');
  const [autopayReviews, setAutopayReviews] = useState<SubscriptionOccurrence[]>([]);
  const [isGuestUpgradeSnoozed, setIsGuestUpgradeSnoozed] = useState(true);
  const createIdempotencyKey = useRef<string | null>(null);
  const resumeDraftAfterAccounts = useRef(false);
  const saveConfirmationAnim = useRef(new RNAnimated.Value(0)).current;
  const motion = useMotion();

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<
    import('@/components/home/QuickPrompts').QuickPrompt | null
  >(null);
  const [modalMode, setModalMode] = useState<'audio' | 'manual' | 'quick-prompt'>('manual');
  const dailyCreditLimit = billingStatus?.credits.daily_limit ?? 0;
  const dailyCreditsRemaining = billingStatus?.credits.daily_credits_remaining ?? 0;
  const shouldShowLowCreditNotice =
    dailyCreditLimit > 0 && dailyCreditsRemaining / dailyCreditLimit < 0.2;

  const handleQuickPromptSelect = useCallback(
    (prompt: import('@/components/home/QuickPrompts').QuickPrompt) => {
      const blank = createBlankForm();
      const now = new Date();
      setAiReview(null);
      setForm({
        ...blank,
        title: prompt.title,
        amount: toAmountInputValue(prompt.amount),
        date: formatDateLabel(now),
        time: formatTime(now) ?? '',
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
        setEntriesError(getFriendlyErrorMessage(error, 'Unable to load entries right now.'));
      } finally {
        if (!silent) setIsEntriesLoading(false);
      }
    },
    [token]
  );

  /**
   * The month strip's figures. No dates: the dashboard's own default range is
   * the 1st to today, which is also what the Insights tab opens on, so the
   * strip and the screen it taps through to describe the same period without
   * either having to agree on a date locally.
   *
   * Failures are swallowed. This is a secondary widget on the primary screen —
   * it renders nothing rather than putting an error where money should be.
   */
  const fetchMonthSummary = useCallback(
    async (silent = false) => {
      if (!token) {
        setMonthDashboard(null);
        setIsMonthLoading(false);
        return;
      }
      if (!silent) setIsMonthLoading(true);
      try {
        setMonthDashboard(await fetchDashboard(token));
      } catch {
        setMonthDashboard(null);
      } finally {
        setIsMonthLoading(false);
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
      void fetchMonthSummary();
      void fetchAccountOptions();
      void fetchSplitOptions();
      void fetchCredits();
      void fetchNotificationCount();
      void isGuestUpgradePromptSnoozed().then(setIsGuestUpgradeSnoozed);
      if (token) {
        void syncSubscriptionAutomation(token)
          .then(() => fetchSubscriptionOccurrences(token))
          .then(setAutopayReviews)
          .catch(() => undefined);
      }
    }, [
      fetchAccountOptions,
      fetchCredits,
      fetchEntries,
      fetchMonthSummary,
      fetchNotificationCount,
      fetchSplitOptions,
      token,
    ])
  );

  useEffect(
    () =>
      subscribeTransactionsChanged(() => {
        void fetchEntries(true);
        // Saving an expense has to move the number at the top of the screen.
        // A strip that still reads yesterday's total after a save is worse
        // than no strip at all.
        void fetchMonthSummary(true);
      }),
    [fetchEntries, fetchMonthSummary]
  );

  const sections = useMemo(() => groupTransactionsBySection(transactions), [transactions]);
  const hasTransactions = sections.length > 0;

  /**
   * The guest upgrade ask. It waits for entries because an account is only worth
   * creating once there is something in it to lose — the whole point of letting
   * people in without one.
   */
  const showGuestUpgradePrompt = shouldShowGuestUpgradePrompt({
    isGuest: !!user?.is_guest,
    entryCount: transactions.length,
    isSnoozed: isGuestUpgradeSnoozed,
  });

  const ensureMicPermission = useCallback(async () => {
    const currentPermission = await getRecordingPermissionsAsync();
    if (currentPermission.status === 'granted') {
      return true;
    }
    const permission = await requestRecordingPermissionsAsync();
    return permission.status === 'granted';
  }, []);

  const startRecording = useCallback(async () => {
    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      setErrorMessage('Microphone permission is required to record audio.');
      return;
    }
    try {
      setErrorMessage(null);
      setRecordedUri(null);
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      haptics.captureStart();
    } catch {
      setErrorMessage('Unable to start recording. Please try again.');
      setIsRecording(false);
    }
  }, [audioRecorder, ensureMicPermission]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await audioRecorder.stop();
      setRecordedUri(audioRecorder.uri);
      haptics.captureStop();
    } catch {
      setErrorMessage('Unable to stop recording. Please try again.');
    } finally {
      setIsRecording(false);
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        // Ignore
      }
    }
  }, [audioRecorder, isRecording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /**
   * Tapping the collapsed pill puts the card back and the cursor in it.
   *
   * The card's size is a pure function of scroll offset, so "expand" means
   * scrolling back to the top — there is no second source of truth to keep in
   * step, and a user who then scrolls down again simply collapses it as usual.
   */
  const handleExpandCapture = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    // Focus after the scroll has run, not with it. Opening the text field flips
    // `isCaptureLocked`, which takes the card out of the scroll interpolation
    // and pins it open — do that immediately and the card snaps to full height
    // while the feed is still gliding. Letting the scroll finish first means
    // the expansion is the animation, and the lock only takes over once the
    // card is already where it belongs.
    setTimeout(() => setIsTextInputVisible(true), CAPTURE_EXPAND_MS);
  }, [scrollRef]);

  /** Recording from the pill brings the card back with it, same as expanding. */
  const handlePillMicPress = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    void handleToggleRecording();
  }, [handleToggleRecording, scrollRef]);

  /**
   * Capture stays open while there is something to lose by closing it — mid
   * recording, mid parse, with a finished clip, or with typed text in the
   * field. Collapsing then would scroll away the Process and Clear buttons the
   * user is reaching for.
   *
   * An *empty* text field deliberately does not lock. It did at first, and that
   * made the pill a one-way door: tapping it opened the field, and the card
   * could never collapse again for the rest of the session unless the user
   * found the "I Prefer To Write" toggle. Nothing is lost by collapsing an
   * empty field — it is still open when the card comes back.
   */
  const isCaptureLocked =
    isRecording || isSubmitting || !!recordedUri || inputText.trim().length > 0;

  /** Whether the collapse is worth running at all — see the constant. */
  const isCaptureCollapsible = transactions.length >= MIN_ENTRIES_FOR_COLLAPSE;

  useEffect(() => {
    if (!saveConfirmation) return undefined;
    saveConfirmationAnim.stopAnimation();
    saveConfirmationAnim.setValue(0);
    const animation = RNAnimated.sequence([
      RNAnimated.timing(saveConfirmationAnim, {
        toValue: 1,
        duration: motion.duration('base'),
        easing: TOAST_IN_EASING,
        useNativeDriver: true,
      }),
      RNAnimated.delay(SAVE_TOAST_DWELL_MS),
      RNAnimated.timing(saveConfirmationAnim, {
        toValue: 0,
        duration: motion.exitDuration('base'),
        easing: TOAST_OUT_EASING,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        setSaveConfirmation(null);
      }
    });
    return () => animation.stop();
  }, [motion, saveConfirmation, saveConfirmationAnim]);

  /**
   * The new-row highlight is a one-shot. Holding the id would re-run the
   * entrance every time the feed re-rendered — on a refetch, a theme change, a
   * tab return — and a row that keeps announcing itself stops meaning anything.
   */
  useEffect(() => {
    if (!newTransactionId) return undefined;
    const timeout = setTimeout(() => setNewTransactionId(null), NEW_ROW_HIGHLIGHT_MS);
    return () => clearTimeout(timeout);
  }, [newTransactionId]);

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

        // Upload before creating the entry. A failure here aborts the save
        // rather than persisting an unusable local device URI.
        const attachmentUrl = await resolveAttachmentForSave(token, formData.attachment);

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
            time: toApiTime(formData.time) ?? undefined,
            attachment: attachmentUrl,
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
            cancel_on_date: formData.subscriptionCancelOnDate.trim(),
            autopay: formData.subscriptionAutopay,
            payment_mode: formData.mode,
            transaction_tag: formData.tag || 'Subscription',
            purpose_type: formData.tag.toLowerCase() === 'investment' ? 'investment' : 'normal_spend',
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
        setNewTransactionId(createdTransaction.id);

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

  const submitPrompt = useCallback(async (overrideText?: string) => {
    if (isSubmitting) return;
    const trimmed = (overrideText ?? inputText).trim();
    // A re-asked suggestion is text, so any pending recording is not part of it.
    const audioUri = overrideText ? null : recordedUri;
    if (!trimmed && !audioUri) {
      setErrorMessage('Please type or record your expense first.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setCreditAction(null);
    setAnswer(null);
    // Typed text that reads as a question waits behind an inline indicator
    // instead of the draft sheet. The server still decides what it was — this
    // only decides where the wait is shown.
    const deferSheet = Boolean(trimmed) && !audioUri && looksLikeQuestion(trimmed);
    setPendingQuestion(deferSheet ? trimmed : null);
    // The phrase is known before the request goes out, so the sheet can show it
    // from the first frame — during the wait it is the only thing on screen
    // saying *which* capture is being read. The rest of the review metadata
    // arrives with the parse.
    setAiSourceText(trimmed);
    setAiInputSource(audioUri ? 'voice' : 'text');
    setAiReview({
      sourceText: trimmed,
      inputSource: audioUri ? 'voice' : 'text',
    });
    setIsParsing(true);
    setModalMode('audio');
    if (!deferSheet) {
      setIsEditOpen(true);
    }
    try {
      let audio:
        | {
            file: File;
            name: string;
          }
        | undefined;
      if (trimmed) {
        audio = undefined;
      } else if (audioUri) {
        const extension = audioUri.split('.').pop();
        const fileName = `recording.${extension ?? 'm4a'}`;
        audio = {
          file: new File(audioUri),
          name: fileName,
        };
      }
      const result = await parseEntryDraft({ token, hintText: trimmed, audio });
      void fetchCredits(true);
      createIdempotencyKey.current = null;

      // The question direction. An answer is not a transaction and must never
      // reach the form — the sheet goes back down and the card takes the feed's
      // first slot instead.
      if (isParseAnswer(result)) {
        setIsEditOpen(false);
        setAiReview(null);
        setPendingQuestion(null);
        setAnswerSourceText(result.source_text ?? trimmed);
        setAnswer(result.answer);
        setInputText('');
        setRecordedUri(null);
        haptics.saved();
        return;
      }

      const data: ParseResponse = result;
      // A capture that was mistaken for a question needs the sheet it did not
      // get; opening it here costs one frame rather than a wrong destination.
      setPendingQuestion(null);
      if (deferSheet) {
        setIsEditOpen(true);
      }
      setAiSourceText(data.source_text ?? trimmed);
      setAiInputSource(audioUri ? 'voice' : 'text');
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
        // What the AI worked from, so the review sheet can show it back. A
        // wrong field is usually a misheard word, and the phrase is the only
        // place that is visible.
        sourceText: data.source_text ?? trimmed,
        inputSource: audioUri ? 'voice' : 'text',
      });
      setForm((prev) => {
        const missing = new Set(data.missing_fields ?? []);
        const formattedDate =
          missing.has('date') || !data.date
            ? formatDateLabel(new Date())
            : normalizeDateLabel(data.date, formatDateLabel(new Date()));
        const tagValue = data.tag ?? data.tags?.[0] ?? '';
        const newType = missing.has('type') ? '' : (toTitleCase(data.type) ?? '');
        const splitDraft = resolveSplitDraft(data, splitFriends, splitGroups);
        const subscriptionCandidate = data.subscription_candidate;
        const subscriptionInterval = isBillingInterval(subscriptionCandidate?.billing_interval)
          ? subscriptionCandidate.billing_interval
          : '';
        const subscriptionPaidDate =
          subscriptionCandidate?.last_charged_date ?? data.date ?? formatApiDate(new Date());
        const inferredNextDueDate =
          subscriptionCandidate?.next_due_date ??
          inferNextSubscriptionDate(subscriptionPaidDate, subscriptionInterval);
        return {
          ...prev,
          title: smartSorting && !missing.has('title') ? (data.title ?? '') : '',
          amount:
            missing.has('amount') || data.amount == null ? '' : toAmountInputValue(data.amount),
          currency: data.currency ?? prev.currency,
          // The parser emits `HH:MM`; the form shows and stores a display string.
          time: formatTime(data.time) ?? prev.time,
          type: newType,
          mode: smartSorting && !missing.has('mode') ? (data.mode ?? '') : '',
          category: smartSorting && !missing.has('category') ? (data.category ?? 'Misc') : 'Misc',
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
          subscriptionCategory: subscriptionCandidate?.category ?? data.category ?? 'Misc',
          subscriptionAmount:
            subscriptionCandidate?.amount != null
              ? toAmountInputValue(subscriptionCandidate.amount)
              : data.amount != null
                ? toAmountInputValue(data.amount)
                : '',
          subscriptionBillingInterval: subscriptionInterval,
          subscriptionNextDueDate: inferredNextDueDate,
          subscriptionReminderDays:
            subscriptionCandidate?.reminder_days != null
              ? String(subscriptionCandidate.reminder_days)
              : '3',
          subscriptionCancelBeforeDue: Boolean(subscriptionCandidate?.cancel_before_due),
          subscriptionCancelOnDate: subscriptionCandidate?.cancel_on_date ?? '',
          subscriptionAutopay: Boolean(subscriptionCandidate?.autopay),
          subscriptionNotes: subscriptionCandidate?.notes ?? '',
        };
      });
      setInputText('');
      setRecordedUri(null);
    } catch (error) {
      // The sheet came up before the request went out, so a failure has to take
      // it back down — the credit card and the error banner both live on Home,
      // behind it.
      setIsEditOpen(false);
      setPendingQuestion(null);
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
        getFriendlyErrorMessage(error, 'Something went wrong while parsing.')
      );
    } finally {
      setIsParsing(false);
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

  const handleSubmitPrompt = useCallback(() => submitPrompt(), [submitPrompt]);

  const renderRecentActivity = () => {
    if (isEntriesLoading) {
      return (
        <SkeletonFrame label="Loading activity" testID="home-activity-skeleton">
          <SkeletonRows count={4} />
        </SkeletonFrame>
      );
    }

    if (entriesError) {
      return (
        <StateView
          icon="wifi-off"
          title="Activity did not load"
          message={entriesError}
          actionLabel="Try again"
          onAction={() => {
            // Retry everything the outage took down, not just the feed. The
            // month strip hides itself on failure rather than showing an
            // error, so without this it would stay missing until the next
            // time the screen regained focus.
            void fetchEntries();
            void fetchMonthSummary();
          }}
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
    // The stagger counts down the feed rather than restarting at every date
    // heading — see the same note on the full list in app/transactions/index.tsx.
    let rowsAbove = 0;

    return (
      <View>
        <SectionHeader
          title="Recent Activity"
          actionLabel="See All"
          onAction={() => router.push('/transactions')}
        />

        <View className="px-6">
          {groupedRecentTransactions.map((group, groupIndex) => {
            const groupOffset = rowsAbove;
            rowsAbove += group.data.length;

            return (
            // Changing the month rewrites the feed under whatever survives it.
            <Animated.View key={group.title} layout={motion.reflow()}>
            <Card
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
                    amount={Math.abs(item.amount)}
                    maskAmount={isStealthMode}
                    date={item.timeLabel ?? item.dateLabel ?? ''}
                    color={item.color}
                    bgColor={item.bgColor}
                    isIncome={item.entryType === 'income'}
                    variant="list"
                    isNew={item.id === newTransactionId}
                    entranceIndex={groupOffset + index}
                    showDivider={!isLastInSection}
                    onPress={(origin) => {
                      router.push({
                        pathname: '/entry/[id]',
                        params: {
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          amount: toAmountString(Math.abs(item.amount)),
                          entryType: item.entryType ?? 'expense',
                          section: item.section,
                          mode: item.mode ?? '',
                          notes: item.notes ?? '',
                          merchant: item.merchant ?? '',
                          dateLabel: item.dateLabel ?? '',
                          rawDate: item.rawDate ?? '',
                          tag: item.tag ?? '',
                          // C9 — the feed's rows travel into detail the same
                          // way the transaction list's do.
                          ...(origin?.icon ? { originIcon: encodeFrame(origin.icon) } : {}),
                          ...(origin?.amount ? { originAmount: encodeFrame(origin.amount) } : {}),
                        },
                      });
                    }}
                  />
                );
              })}
            </Card>
            </Animated.View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      {/* One positioning context for the pinned block and the feed it floats
          over. Without it the block anchors to the SafeAreaView and renders
          under the status bar. */}
      <View className="flex-1">
        {/* The scroll view's frame never changes, so the feed always moves 1:1
          with the finger while the block pinned over it collapses. Its top
          padding is the pinned block's expanded height, which is measured
          rather than guessed — the capture card is a different height while
          recording, while a draft is in hand, and with the text field open. */}
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setViewportHeight(Math.round(event.nativeEvent.layout.height))}
          contentContainerStyle={{
            paddingTop: pinnedTopHeight + captureExpandedHeight,
            paddingBottom: LIST_BOTTOM_PADDING,
            // The card shrinks one pixel per pixel scrolled, so it needs a
            // scroll range of exactly its collapse distance to finish. A feed
            // that runs out before then leaves the card stranded halfway with
            // nowhere left to scroll. Asking for a content height of one
            // viewport plus that distance is the smallest guarantee that the
            // pill can always fully form — and costs nothing on a long feed,
            // which already exceeds it.
            ...(isCaptureCollapsible && viewportHeight > 0
              ? {
                  minHeight:
                    viewportHeight + captureExpandedHeight - CAPTURE_COLLAPSED_HEIGHT,
                }
              : null),
          }}>
          {autopayReviews[0] ? (
          <View className="mx-6 mb-4 rounded-3xl border p-4" style={{ backgroundColor: themeTokens.colors.card, borderColor: themeTokens.colors.accent }}>
            <View className="flex-row items-start gap-3">
              <MaterialCommunityIcons name="bank-check" size={24} color={themeTokens.colors.accent} />
              <View className="flex-1">
                <ThemedText className="font-black">Autopay transaction added</ThemedText>
                <ThemedText className="mt-1 text-xs opacity-60">Review the recurring payment. It is already in your transaction list.</ThemedText>
                <View className="mt-3 flex-row gap-2">
                  <Pressable className="rounded-xl px-4 py-2" style={{ backgroundColor: themeTokens.colors.accent }} onPress={() => {
                    const item = autopayReviews[0];
                    if (!token) return;
                    void confirmSubscriptionOccurrence(token, item.id).then(() => setAutopayReviews((items) => items.filter((entry) => entry.id !== item.id)));
                  }}><ThemedText className="text-xs font-black text-white">Confirm</ThemedText></Pressable>
                  <Pressable className="rounded-xl border px-4 py-2" style={{ borderColor: themeTokens.colors.accent }} onPress={() => {
                    const item = autopayReviews[0];
                    if (!token) return;
                    void revertSubscriptionOccurrence(token, item.id).then((result) => router.push({ pathname: '/entry/[id]', params: { id: String(result.entry_id), edit: '1' } }));
                  }}><ThemedText className="text-xs font-black" style={{ color: themeTokens.colors.accent }}>Correct / revert</ThemedText></Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : null}

          {showGuestUpgradePrompt ? (
            <GuestUpgradePrompt
              entryCount={transactions.length}
              onUpgrade={() => router.push('/auth?mode=link')}
              onDismiss={() => {
                setIsGuestUpgradeSnoozed(true);
                void snoozeGuestUpgradePrompt();
              }}
            />
          ) : null}

          {shouldShowLowCreditNotice ? (
            <View style={{ marginHorizontal: 24, marginBottom: themeTokens.spacing.md }}>
              <CreditStatusCard
                credits={billingStatus?.credits ?? null}
                loading={isBillingLoading}
                compact
                onPress={() => router.push('/billing')}
              />
            </View>
          ) : null}

          {/* Questions answer here, at the top of the feed, directly under the
              capture field that asked them — not in a sheet. */}
          {pendingQuestion ? (
            <View
              className="mx-6 mb-4 flex-row items-center gap-3 rounded-3xl border p-4"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF8F4',
                borderColor: themeTokens.colors.border,
              }}>
              <ActivityIndicator size="small" color={themeTokens.colors.accent} />
              <ThemedText
                variant="caption"
                numberOfLines={2}
                style={{ flex: 1, color: `${themeTokens.colors.text}99` }}>
                Looking through your transactions…
              </ThemedText>
            </View>
          ) : null}

          {answer ? (
            <AnswerCard
              answer={answer}
              sourceText={answerSourceText}
              onDismiss={() => setAnswer(null)}
              onAskSuggestion={(question) => {
                setAnswer(null);
                void submitPrompt(question);
              }}
            />
          ) : null}

          <QuickPrompts
            key={`quick-prompts-${quickPromptKey}`}
            onSelect={handleQuickPromptSelect}
            onAdd={handleAddPrompt}
            onLongPress={handleLongPressPrompt}
          />

          {errorMessage && (
            <ErrorBanner
              message={errorMessage}
              style={{ marginHorizontal: 24, marginBottom: 24 }}
            />
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
        </Animated.ScrollView>

        {/* Pinned above the feed: identity, the month, and capture. The month
          strip staying put is the point of W2 — a figure you have to hunt for
          is not a reason to open the app. */}
        <View
          className="absolute inset-x-0 top-0"
          style={{ backgroundColor: themeTokens.colors.background }}>
          <View
            onLayout={(event) => setPinnedTopHeight(Math.round(event.nativeEvent.layout.height))}>
            <HomeHeader
              unreadCount={unreadNotifications}
              onNotificationsPress={() => router.push('/notifications')}
            />

            <MonthStrip
              dashboard={monthDashboard}
              loading={isMonthLoading}
              onPress={() =>
                router.push({ pathname: '/(tabs)/insight', params: { period: 'this_month' } })
              }
            />
          </View>

          <CollapsibleCapture
            scrollY={scrollY}
            onExpand={handleExpandCapture}
            onMicPress={handlePillMicPress}
            isRecording={isRecording}
            locked={isCaptureLocked || !isCaptureCollapsible}
            onExpandedHeightChange={setCaptureExpandedHeight}>
            <View className="px-6 pb-4">
              <ThemedText className="text-xs text-gray-500 font-medium text-center">
                Speak naturally. Finnri will organize it.
              </ThemedText>
            </View>

            <VoiceInputCard
              recorder={audioRecorder}
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
          </CollapsibleCapture>
        </View>
      </View>

      {hasTransactions && (
        <Pressable
          accessibilityRole="button"
          onPress={handleOpenManualEntry}
          style={[
            {
              backgroundColor: theme.accent,
              height: FAB_SIZE,
              width: FAB_SIZE,
              borderRadius: FAB_SIZE / 2,
              bottom: FAB_BOTTOM_OFFSET,
              right: FAB_RIGHT_OFFSET,
            },
            themeTokens.shadows.soft,
          ]}
          className="items-center justify-center absolute elevation-5">
          <MaterialCommunityIcons name="plus" size={32} color="white" />
        </Pressable>
      )}

      {saveConfirmation && (
        <RNAnimated.View
          accessibilityLiveRegion="polite"
          className="absolute self-center z-50 flex-row items-center gap-2 rounded-full px-3 py-2 shadow-md"
          style={{
            bottom: SAVE_TOAST_BOTTOM_OFFSET,
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
        </RNAnimated.View>
      )}

      <TransactionFormModal
        visible={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={form}
        onSave={handleConfirmEntry}
        mode={modalMode}
        isParsing={isParsing}
        aiReview={aiReview}
        accounts={accounts}
        splitFriends={splitFriends}
        splitGroups={splitGroups}
        recentEntries={transactions}
        onDraftChange={setForm}
        onManageAccounts={() => {
          resumeDraftAfterAccounts.current = true;
          setIsEditOpen(false);
          router.push('/money?segment=accounts');
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

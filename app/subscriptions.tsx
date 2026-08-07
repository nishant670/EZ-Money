import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/navigation/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fetchAccounts, getAccountsForPaymentMode, type Account } from '@/lib/accounts';
import { getFriendlyErrorMessage } from '@/lib/api-error';
import { saveRecurringCandidateDecision } from '@/lib/insights';
import {
  BillingInterval,
  Subscription,
  SubscriptionStatus,
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  markSubscriptionPaid,
  syncSubscriptionReminders,
  updateSubscription,
} from '@/lib/subscriptions';

const intervalOptions: { value: BillingInterval; label: string; helper: string }[] = [
  { value: 'daily', label: 'Daily', helper: 'Every day' },
  { value: 'business_daily', label: 'Market days', helper: 'Skips weekends and market holidays' },
  { value: 'weekly', label: 'Weekly', helper: 'Every 7 days' },
  { value: 'biweekly', label: 'Biweekly', helper: 'Every 14 days' },
  { value: 'monthly', label: 'Monthly', helper: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', helper: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', helper: 'Every year' },
];
const statusOptions: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];
const categoryOptions = [
  'Entertainment',
  'Productivity',
  'Cloud',
  'Bills',
  'Membership',
  'Learning',
];
const reminderOptions = [0, 1, 3, 7, 14, 30];

const todayISO = () => dateToApiDate(new Date());
const nextMonthISO = () => {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return dateToApiDate(next);
};
const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());
const sanitizeAmount = (value: string) => value.replace(/[^0-9.]/g, '');
const formatMoney = (value: number | string) =>
  `₹${Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
  })}`;
const toParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function apiDateToLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function dateToApiDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDueDateLabel(value: string) {
  return apiDateToLocalDate(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function reminderLabel(days: number) {
  if (days === 0) return 'On due date';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

function intervalLabel(value: BillingInterval) {
  return intervalOptions.find((option) => option.value === value)?.label ?? value;
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuthStore();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('Streaming');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [amount, setAmount] = useState('499');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [nextDueDate, setNextDueDate] = useState(nextMonthISO());
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [reminderDays, setReminderDays] = useState(3);
  const [cancelBeforeDue, setCancelBeforeDue] = useState(false);
  const [cancelOnDate, setCancelOnDate] = useState('');
  const [autopay, setAutopay] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [accountID, setAccountID] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pendingDate, setPendingDate] = useState(apiDateToLocalDate(nextDueDate));
  const [datePickerTarget, setDatePickerTarget] = useState<'due' | 'cancel'>('due');
  const source = toParam(params.source);
  const prefillName = toParam(params.name);
  const prefillMerchant = toParam(params.merchant);
  const prefillCategory = toParam(params.category);
  const prefillAmount = toParam(params.amount);
  const prefillInterval = toParam(params.interval);
  const prefillNextDueDate = toParam(params.nextDueDate);
  const prefillNotes = toParam(params.notes);
  const candidateKey = toParam(params.candidateKey);

  const dueCount = useMemo(
    () =>
      subscriptions.filter((item) => item.due_state === 'due_soon' || item.due_state === 'overdue')
        .length,
    [subscriptions]
  );
  const activeCount = useMemo(
    () => subscriptions.filter((item) => item.status === 'active').length,
    [subscriptions]
  );
  const projectedMonthly = useMemo(
    () =>
      subscriptions
        .filter((item) => item.status === 'active')
        .reduce((sum, item) => {
          const amountValue = Number(item.amount || 0);
          switch (item.billing_interval) {
            case 'daily':
              return sum + amountValue * 30;
            case 'weekly':
              return sum + amountValue * 4;
            case 'biweekly':
              return sum + amountValue * 2;
            case 'quarterly':
              return sum + amountValue / 3;
            case 'yearly':
              return sum + amountValue / 12;
            default:
              return sum + amountValue;
          }
        }, 0),
    [subscriptions]
  );
  const formTitle = editing ? 'Edit subscription' : 'New subscription';

  useEffect(() => {
    if (source !== 'recurring_review' || editing) return;
    const amountValue = sanitizeAmount(prefillAmount ?? '');
    setName(prefillName?.trim() || prefillMerchant?.trim() || 'Recurring payment');
    setMerchant(prefillMerchant?.trim() ?? '');
    setCategory(prefillCategory?.trim() || 'Bills');
    if (amountValue) setAmount(amountValue);
    if (prefillInterval === 'weekly' || prefillInterval === 'monthly') setInterval(prefillInterval);
    if (prefillNextDueDate?.match(/^\d{4}-\d{2}-\d{2}$/)) setNextDueDate(prefillNextDueDate);
    setStatus('active');
    setReminderDays(prefillInterval === 'weekly' ? 1 : 3);
    setAutopay(false);
    setNotes(prefillNotes ?? '');
    setShowForm(true);
    setError(null);
  }, [
    editing,
    prefillAmount,
    prefillCategory,
    prefillInterval,
    prefillMerchant,
    prefillName,
    prefillNextDueDate,
    prefillNotes,
    source,
  ]);

  const resetForm = () => {
    setEditing(null);
    setName('Streaming');
    setMerchant('');
    setCategory('Entertainment');
    setAmount('499');
    setInterval('monthly');
    setNextDueDate(nextMonthISO());
    setStatus('active');
    setReminderDays(3);
    setCancelBeforeDue(false);
    setCancelOnDate('');
    setAutopay(false);
    setPaymentMode('Cash');
    setAccountID(null);
    setNotes('');
    setError(null);
  };

  const load = useCallback(async () => {
    if (!token) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await syncSubscriptionReminders(token);
      const [subscriptionItems, accountItems] = await Promise.all([fetchSubscriptions(token), fetchAccounts(token)]);
      setSubscriptions(subscriptionItems);
      if (subscriptionItems.length === 0) setShowForm(true);
      setAccounts(accountItems);
    } catch (loadError) {
      setError(getFriendlyErrorMessage(loadError, 'Unable to load subscriptions right now.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const editSubscription = (subscription: Subscription) => {
    setEditing(subscription);
    setName(subscription.name);
    setMerchant(subscription.merchant ?? '');
    setCategory(subscription.category ?? '');
    setAmount(String(subscription.amount));
    setInterval(subscription.billing_interval);
    setNextDueDate(subscription.next_due_date);
    setStatus(subscription.status);
    setReminderDays(subscription.reminder_days);
    setCancelBeforeDue(!!subscription.cancel_before_due);
    setCancelOnDate(subscription.cancel_on_date ?? '');
    setAutopay(subscription.autopay);
    setPaymentMode(subscription.payment_mode || 'Cash');
    setAccountID(subscription.account_id ?? null);
    setNotes(subscription.notes ?? '');
    setError(null);
    setShowForm(true);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openDueDatePicker = () => {
    const currentDate = apiDateToLocalDate(nextDueDate);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        minimumDate: new Date(),
        onValueChange: (_event, selectedDate) => {
          if (selectedDate) {
            setNextDueDate(dateToApiDate(selectedDate));
          }
        },
        onDismiss: () => undefined,
      });
      return;
    }
    setDatePickerTarget('due');
    setPendingDate(currentDate);
    setIsDatePickerVisible(true);
  };

  const openCancellationDatePicker = () => {
    const currentDate = apiDateToLocalDate(cancelOnDate || todayISO());
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: currentDate, mode: 'date', minimumDate: new Date(), onValueChange: (_event, selectedDate) => selectedDate && setCancelOnDate(dateToApiDate(selectedDate)), onDismiss: () => undefined });
      return;
    }
    setDatePickerTarget('cancel');
    setPendingDate(currentDate);
    setIsDatePickerVisible(true);
  };

  const saveSubscription = async () => {
    if (!token || saving) return;
    const amountValue = parseAmount(amount);
    const validation: string[] = [];
    if (!name.trim()) validation.push('Name is required.');
    if (!Number.isFinite(amountValue) || amountValue <= 0)
      validation.push('Amount must be positive.');
    if (!nextDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) validation.push('Choose a valid next due date.');
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) {
      validation.push('Reminder must be between 0 and 30 days.');
    }
    if (cancelBeforeDue && !cancelOnDate.match(/^\d{4}-\d{2}-\d{2}$/)) validation.push('Choose a cancellation reminder date.');
    if ((interval === 'daily' || interval === 'business_daily') && !autopay) validation.push('Daily schedules require Autopay.');
    if (autopay && !accountID) validation.push('Select the account used for Autopay.');
    if (validation.length > 0) {
      setError(validation.join('\n'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        merchant: merchant.trim(),
        category: category.trim(),
        amount: amountValue,
        billing_interval: interval,
        next_due_date: nextDueDate,
        status,
        reminder_days: reminderDays,
        cancel_before_due: cancelBeforeDue,
        cancel_on_date: cancelBeforeDue ? cancelOnDate : '',
        autopay,
        payment_mode: paymentMode,
        transaction_tag: editing?.transaction_tag ?? 'Subscription',
        purpose_type: editing?.purpose_type ?? 'normal_spend',
        account_id: accountID,
        notes: notes.trim(),
      };
      if (editing) {
        await updateSubscription(token, editing.id, payload);
      } else {
        await createSubscription(token, payload);
        if (source === 'recurring_review' && candidateKey) {
          await saveRecurringCandidateDecision(token, {
            candidate_key: candidateKey,
            merchant: merchant.trim(),
            category: category.trim(),
            decision: 'tracked',
          });
        }
      }
      resetForm();
      await load();
      setShowForm(false);
    } catch (saveError) {
      setError(getFriendlyErrorMessage(saveError, 'Unable to save this subscription.'));
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (subscription: Subscription) => {
    if (!token) return;
    try {
      await markSubscriptionPaid(token, subscription.id, todayISO());
      await load();
    } catch (paidError) {
      setError(getFriendlyErrorMessage(paidError, 'Unable to mark this subscription paid.'));
    }
  };

  const cancelNow = async (subscription: Subscription) => {
    if (!token) return;
    try {
      await updateSubscription(token, subscription.id, {
        name: subscription.name,
        merchant: subscription.merchant,
        category: subscription.category,
        amount: Number(subscription.amount),
        billing_interval: subscription.billing_interval,
        next_due_date: subscription.next_due_date,
        status: 'cancelled',
        reminder_days: subscription.reminder_days,
        cancel_before_due: false,
        notes: subscription.notes,
        account_id: subscription.account_id ?? null,
      });
      if (editing?.id === subscription.id) resetForm();
      await load();
    } catch (cancelError) {
      setError(getFriendlyErrorMessage(cancelError, 'Unable to cancel this subscription.'));
    }
  };

  const confirmDelete = (subscription: Subscription) => {
    if (!token) return;
    Alert.alert(
      'Delete subscription?',
      `${subscription.name} reminders will stop after deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubscription(token, subscription.id);
              if (editing?.id === subscription.id) resetForm();
              await load();
            } catch (deleteError) {
              setError(getFriendlyErrorMessage(deleteError, 'Unable to delete this subscription.'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader
          title="Subscriptions"
          subtitle={showForm ? undefined : `${dueCount} need review`}
          onBack={() => {
            if (showForm && subscriptions.length > 0) {
              resetForm();
              setShowForm(false);
              return;
            }
            router.back();
          }}
          rightIcon={!loading && subscriptions.length > 0 && !showForm ? 'plus' : undefined}
          onRightPress={openCreateForm}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 16 }}>
          {!showForm && <View className="flex-row gap-3">
            <SummaryTile label="Active" value={String(activeCount)} colors={colors} />
            <SummaryTile
              label="Monthly run-rate"
              value={formatMoney(projectedMonthly)}
              colors={colors}
            />
          </View>}

          {showForm && <View
            className="rounded-[28px] border p-4"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <View className="mb-5 flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
                  {formTitle}
                </ThemedText>
                <ThemedText className="mt-1 text-xs leading-5" style={{ color: muted }}>
                  Track recurring payments, renewal reminders, and cancellation decisions.
                </ThemedText>
              </View>
              <View className="rounded-2xl px-3 py-2" style={{ backgroundColor: colors.secondary }}>
                <ThemedText
                  className="text-[10px] font-black uppercase"
                  style={{ color: colors.accent }}>
                  INR
                </ThemedText>
              </View>
            </View>

            <Field label="Subscription name" value={name} onChangeText={setName} colors={colors} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label="Merchant"
                  value={merchant}
                  onChangeText={setMerchant}
                  colors={colors}
                  placeholder="Netflix, AWS"
                />
              </View>
              <View className="w-32">
                <Field
                  label="Amount"
                  value={amount}
                  onChangeText={(value) => setAmount(sanitizeAmount(value))}
                  keyboardType="decimal-pad"
                  colors={colors}
                />
              </View>
            </View>

            <ChipPicker
              label="Category"
              options={categoryOptions}
              active={category}
              onSelect={setCategory}
              colors={colors}
            />

            <View className="mb-4">
              <ThemedText
                className="mb-2 text-[11px] font-black uppercase"
                style={{ color: muted }}>
                Billing interval
              </ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {intervalOptions.map((option) => {
                  const selected = option.value === interval;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setInterval(option.value);
                        if (option.value === 'daily' || option.value === 'business_daily') {
                          setAutopay(true);
                          setReminderDays(0);
                        }
                      }}
                      className="w-[31%] rounded-2xl border p-3"
                      style={{
                        backgroundColor: selected ? colors.secondary : colors.background,
                        borderColor: selected ? colors.accent : colors.border,
                      }}>
                      <ThemedText
                        className="text-xs font-black"
                        style={{ color: selected ? colors.accent : colors.text }}>
                        {option.label}
                      </ThemedText>
                      <ThemedText className="mt-1 text-[10px]" style={{ color: muted }}>
                        {option.helper}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.background }}>
              <View className="flex-row items-center justify-between"><View className="flex-1 pr-3"><ThemedText className="text-sm font-black">Autopay</ThemedText><ThemedText className="mt-1 text-xs" style={{ color: muted }}>Add each recurring payment automatically and ask you to confirm it.</ThemedText></View><Switch value={autopay} onValueChange={setAutopay} trackColor={{ false: '#E0E0E0', true: colors.accent }} thumbColor="white" /></View>
              {autopay && <>
                <View className="mt-4 flex-row flex-wrap gap-2">{['Bank Account', 'UPI', 'Credit Card'].map((mode) => <Pill key={mode} label={mode} selected={paymentMode === mode} onPress={() => { setPaymentMode(mode); setAccountID(null); }} colors={colors} />)}</View>
                <View className="mt-3 flex-row flex-wrap gap-2">{getAccountsForPaymentMode(accounts, paymentMode).map((account) => <Pill key={account.id} label={account.name} selected={accountID === account.id} onPress={() => setAccountID(account.id)} colors={colors} />)}</View>
                <Pressable className="mt-3 flex-row items-center gap-2" onPress={() => router.push('/accounts/manage')}><MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.accent} /><ThemedText className="text-xs font-black" style={{ color: colors.accent }}>Add or manage payment account</ThemedText></Pressable>
              </>}
            </View>

            <Pressable
              onPress={openDueDatePicker}
              className="mb-4 flex-row items-center justify-between rounded-2xl border p-4"
              style={{ backgroundColor: colors.background, borderColor: colors.border }}>
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: colors.secondary }}>
                  <MaterialCommunityIcons
                    name="calendar-check-outline"
                    size={22}
                    color={colors.accent}
                  />
                </View>
                <View>
                  <ThemedText className="text-[11px] font-black uppercase" style={{ color: muted }}>
                    Next payment date
                  </ThemedText>
                  <ThemedText className="mt-1 text-sm font-black" style={{ color: colors.text }}>
                    {formatDueDateLabel(nextDueDate)}
                  </ThemedText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={muted} />
            </Pressable>

            {interval !== 'daily' && interval !== 'business_daily' ? <View className="mb-4">
              <ThemedText
                className="mb-2 text-[11px] font-black uppercase"
                style={{ color: muted }}>
                Reminder
              </ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {reminderOptions.map((days) => (
                  <Pill
                    key={days}
                    label={reminderLabel(days)}
                    selected={reminderDays === days}
                    onPress={() => setReminderDays(days)}
                    colors={colors}
                  />
                ))}
              </View>
            </View> : <View className="mb-4 rounded-2xl p-3" style={{ backgroundColor: colors.secondary }}><ThemedText className="text-xs font-bold" style={{ color: colors.accent }}>Daily and market-day transactions are added automatically. No daily reminder is sent.</ThemedText></View>}

            {cancelBeforeDue && (
              <Pressable onPress={openCancellationDatePicker} className="mb-4 flex-row items-center justify-between rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.background }}>
                <View><ThemedText className="text-[11px] font-black uppercase" style={{ color: muted }}>Cancellation reminder date</ThemedText><ThemedText className="mt-1 text-sm font-black">{cancelOnDate || 'Choose date'}</ThemedText></View>
                <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.accent} />
              </Pressable>
            )}

            <View
              className="mb-4 rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.background }}>
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <ThemedText className="text-sm font-black" style={{ fontFamily: Fonts.title }}>
                    Remind me to cancel
                  </ThemedText>
                  <ThemedText className="mt-1 text-xs leading-5" style={{ color: muted }}>
                    Reminder notification will explicitly ask you to cancel before the next payment.
                  </ThemedText>
                </View>
                <Switch
                  value={cancelBeforeDue}
                  onValueChange={(enabled) => {
                    setCancelBeforeDue(enabled);
                    if (enabled && reminderDays === 0) setReminderDays(1);
                  }}
                  trackColor={{ false: '#E0E0E0', true: colors.accent }}
                  thumbColor="white"
                />
              </View>
            </View>

            <SegmentedControl
              label="Status"
              values={statusOptions}
              active={status}
              onSelect={setStatus}
              colors={colors}
            />

            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              colors={colors}
              placeholder="Plan tier, cancellation link, family plan details"
            />

            {error && (
              <View className="mb-3 rounded-2xl px-3 py-2" style={{ backgroundColor: '#FFEBEE' }}>
                <ThemedText className="text-xs font-bold" style={{ color: '#D32F2F' }}>
                  {error}
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={saveSubscription}
              disabled={saving}
              className="h-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <ThemedText className="text-sm font-black" style={{ color: 'white' }}>
                  {editing ? 'Update subscription' : 'Create subscription'}
                </ThemedText>
              )}
            </Pressable>
          </View>}

          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : !showForm && subscriptions.length > 0 ? (
            <View className="gap-3">
              {subscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  selected={editing?.id === subscription.id}
                  colors={colors}
                  muted={muted}
                  onPress={() => editSubscription(subscription)}
                  onMarkPaid={() => void markPaid(subscription)}
                  onCancelNow={() => void cancelNow(subscription)}
                  onDelete={() => confirmDelete(subscription)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="slide"
        visible={isDatePickerVisible}
        onRequestClose={() => setIsDatePickerVisible(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[28px] p-5" style={{ backgroundColor: colors.card }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Pressable onPress={() => setIsDatePickerVisible(false)}>
                <ThemedText className="text-sm font-black" style={{ color: muted }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
                {datePickerTarget === 'cancel' ? 'Cancellation reminder' : 'Next payment'}
              </ThemedText>
              <Pressable
                onPress={() => {
                  if (datePickerTarget === 'cancel') setCancelOnDate(dateToApiDate(pendingDate));
                  else setNextDueDate(dateToApiDate(pendingDate));
                  setIsDatePickerVisible(false);
                }}>
                <ThemedText className="text-sm font-black" style={{ color: colors.accent }}>
                  Done
                </ThemedText>
              </Pressable>
            </View>
            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onValueChange={(_, selectedDate) => {
                if (selectedDate) setPendingDate(selectedDate);
              }}
              onDismiss={() => setIsDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
};

function Field({
  label,
  value,
  onChangeText,
  colors,
  placeholder,
  keyboardType = 'default',
}: FieldProps) {
  return (
    <View className="mb-3">
      <ThemedText
        className="mb-1 text-[11px] font-black uppercase"
        style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={`${colors.text}66`}
        className="h-12 rounded-2xl border px-4 text-sm"
        style={{
          borderColor: colors.border,
          color: colors.text,
          backgroundColor: colors.background,
        }}
      />
    </View>
  );
}

type ChipPickerProps = {
  label: string;
  options: string[];
  active: string;
  onSelect: (value: string) => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

function ChipPicker({ label, options, active, onSelect, colors }: ChipPickerProps) {
  return (
    <View className="mb-4">
      <ThemedText
        className="mb-2 text-[11px] font-black uppercase"
        style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Pill
            key={option}
            label={option}
            selected={active === option}
            onPress={() => onSelect(option)}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

type PillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

function Pill({ label, selected, onPress, colors }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full border px-3 py-2"
      style={{
        backgroundColor: selected ? colors.secondary : colors.background,
        borderColor: selected ? colors.accent : colors.border,
      }}>
      <ThemedText
        className="text-[11px] font-black"
        style={{ color: selected ? colors.accent : `${colors.text}99` }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type SegmentedControlProps<T extends string> = {
  label: string;
  values: { value: T; label: string }[];
  active: T;
  onSelect: (value: T) => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

function SegmentedControl<T extends string>({
  label,
  values,
  active,
  onSelect,
  colors,
}: SegmentedControlProps<T>) {
  return (
    <View className="mb-3">
      <ThemedText
        className="mb-1 text-[11px] font-black uppercase"
        style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: colors.background }}>
        {values.map((option) => {
          const selected = option.value === active;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              className="flex-1 items-center rounded-xl py-2"
              style={{ backgroundColor: selected ? colors.secondary : 'transparent' }}>
              <ThemedText
                className="text-[11px] font-black uppercase"
                style={{ color: selected ? colors.accent : `${colors.text}99` }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SummaryTileProps = {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

function SummaryTile({ label, value, colors }: SummaryTileProps) {
  return (
    <View className="flex-1 rounded-[24px] p-4" style={{ backgroundColor: colors.card }}>
      <ThemedText className="text-[10px] font-black uppercase opacity-40">{label}</ThemedText>
      <ThemedText className="mt-2 text-sm font-black" style={{ color: colors.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

type SubscriptionCardProps = {
  subscription: Subscription;
  selected: boolean;
  colors: ReturnType<typeof useThemeTokens>['colors'];
  muted: string;
  onPress: () => void;
  onMarkPaid: () => void;
  onCancelNow: () => void;
  onDelete: () => void;
};

function SubscriptionCard({
  subscription,
  selected,
  colors,
  muted,
  onPress,
  onMarkPaid,
  onCancelNow,
  onDelete,
}: SubscriptionCardProps) {
  const urgent = subscription.due_state === 'overdue' || subscription.due_state === 'due_soon';
  const stateLabel = subscription.due_state.replace('_', ' ');
  const isActive = subscription.status === 'active';
  return (
    <Pressable
      onPress={onPress}
      className="rounded-[28px] border p-4"
      style={{
        backgroundColor: colors.card,
        borderColor: selected ? colors.accent : urgent ? '#F9A825' : colors.border,
      }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
            {subscription.name}
          </ThemedText>
          <ThemedText className="mt-1 text-xs" style={{ color: muted }}>
            {subscription.category || 'Uncategorized'} ·{' '}
            {intervalLabel(subscription.billing_interval)}
          </ThemedText>
        </View>
        <ThemedText className="text-base font-black" style={{ color: colors.accent }}>
          {formatMoney(subscription.amount)}
        </ThemedText>
      </View>
      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <ThemedText
            className="text-xs font-bold capitalize"
            style={{ color: urgent ? '#F57F17' : muted }}>
            {stateLabel}
          </ThemedText>
          <ThemedText className="mt-1 text-[11px]" style={{ color: muted }}>
            Due {formatDueDateLabel(subscription.next_due_date)} ·{' '}
            {reminderLabel(subscription.reminder_days)}
          </ThemedText>
          {subscription.cancel_before_due && (
            <View
              className="mt-2 self-start rounded-full px-2 py-1"
              style={{ backgroundColor: '#FFF3E0' }}>
              <ThemedText className="text-[10px] font-black uppercase" style={{ color: '#EF6C00' }}>
                Cancel reminder
              </ThemedText>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-4">
          {isActive && (
            <Pressable onPress={onMarkPaid} hitSlop={10}>
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.accent} />
            </Pressable>
          )}
          {isActive && (
            <Pressable onPress={onCancelNow} hitSlop={10}>
              <MaterialCommunityIcons name="calendar-remove-outline" size={21} color="#EF6C00" />
            </Pressable>
          )}
          <Pressable onPress={onDelete} hitSlop={10}>
            <MaterialCommunityIcons name="trash-can-outline" size={21} color="#D32F2F" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

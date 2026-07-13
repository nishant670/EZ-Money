import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
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

const intervals: BillingInterval[] = ['weekly', 'monthly', 'yearly'];
const statuses: SubscriptionStatus[] = ['active', 'paused', 'cancelled'];

const todayISO = () => new Date().toISOString().slice(0, 10);
const nextMonthISO = () => {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
};
const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());
const sanitizeAmount = (value: string) => value.replace(/[^0-9.]/g, '');
const sanitizeDate = (value: string) => value.replace(/[^0-9-]/g, '').slice(0, 10);
const formatMoney = (value: number | string) =>
  `₹${Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
  })}`;

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [name, setName] = useState('Streaming');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [amount, setAmount] = useState('499');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [nextDueDate, setNextDueDate] = useState(nextMonthISO());
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [reminderDays, setReminderDays] = useState('3');
  const [notes, setNotes] = useState('');

  const dueCount = useMemo(
    () => subscriptions.filter((item) => item.due_state === 'due_soon' || item.due_state === 'overdue').length,
    [subscriptions]
  );
  const formTitle = editing ? 'Edit subscription' : 'New subscription';

  const resetForm = () => {
    setEditing(null);
    setName('Streaming');
    setMerchant('');
    setCategory('Entertainment');
    setAmount('499');
    setInterval('monthly');
    setNextDueDate(nextMonthISO());
    setStatus('active');
    setReminderDays('3');
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
      setSubscriptions(await fetchSubscriptions(token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load subscriptions right now.');
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
    setReminderDays(String(subscription.reminder_days));
    setNotes(subscription.notes ?? '');
    setError(null);
  };

  const saveSubscription = async () => {
    if (!token || saving) return;
    const amountValue = parseAmount(amount);
    const reminderValue = Math.round(parseAmount(reminderDays || '0'));
    const validation: string[] = [];
    if (!name.trim()) validation.push('Name is required.');
    if (!Number.isFinite(amountValue) || amountValue <= 0) validation.push('Amount must be positive.');
    if (!nextDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) validation.push('Next due date must use YYYY-MM-DD.');
    if (!Number.isInteger(reminderValue) || reminderValue < 0 || reminderValue > 30) {
      validation.push('Reminder days must be between 0 and 30.');
    }
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
        reminder_days: reminderValue,
        notes: notes.trim(),
      };
      if (editing) {
        await updateSubscription(token, editing.id, payload);
      } else {
        await createSubscription(token, payload);
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this subscription.');
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
      setError(paidError instanceof Error ? paidError.message : 'Unable to mark this subscription paid.');
    }
  };

  const confirmDelete = (subscription: Subscription) => {
    if (!token) return;
    Alert.alert('Delete subscription?', `${subscription.name} reminders will stop after deletion.`, [
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
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this subscription.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.card }}
            hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </Pressable>
          <View className="items-center">
            <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
              Subscriptions
            </ThemedText>
            <ThemedText className="text-xs" style={{ color: muted }}>
              {dueCount} need review
            </ThemedText>
          </View>
          <Pressable
            onPress={resetForm}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.card }}
            hitSlop={12}>
            <MaterialCommunityIcons name="plus" size={22} color={colors.accent} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 16 }}>
          <View className="rounded-[28px] border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
              {formTitle}
            </ThemedText>
            <ThemedText className="mb-4 mt-1 text-xs" style={{ color: muted }}>
              Recurring INR expense reminder
            </ThemedText>

            <Field label="Name" value={name} onChangeText={setName} colors={colors} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Merchant" value={merchant} onChangeText={setMerchant} colors={colors} />
              </View>
              <View className="flex-1">
                <Field label="Category" value={category} onChangeText={setCategory} colors={colors} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label="Amount"
                  value={amount}
                  onChangeText={(value) => setAmount(sanitizeAmount(value))}
                  keyboardType="decimal-pad"
                  colors={colors}
                />
              </View>
              <View className="flex-1">
                <Field
                  label="Next due"
                  value={nextDueDate}
                  onChangeText={(value) => setNextDueDate(sanitizeDate(value))}
                  keyboardType="numbers-and-punctuation"
                  colors={colors}
                />
              </View>
            </View>

            <SegmentedControl
              label="Interval"
              values={intervals}
              active={interval}
              onSelect={setInterval}
              colors={colors}
            />
            <SegmentedControl
              label="Status"
              values={statuses}
              active={status}
              onSelect={setStatus}
              colors={colors}
            />
            <View className="flex-row gap-3">
              <View className="w-28">
                <Field
                  label="Remind"
                  value={reminderDays}
                  onChangeText={(value) => setReminderDays(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  colors={colors}
                />
              </View>
              <View className="flex-1">
                <Field label="Notes" value={notes} onChangeText={setNotes} colors={colors} />
              </View>
            </View>

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
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : subscriptions.length === 0 ? (
            <View className="items-center rounded-[28px] border p-8" style={{ borderColor: colors.border }}>
              <MaterialCommunityIcons name="calendar-sync-outline" size={36} color={colors.accent} />
              <ThemedText className="mt-3 text-center text-sm font-black">
                No subscriptions yet
              </ThemedText>
              <ThemedText className="mt-1 text-center text-xs" style={{ color: muted }}>
                Add rent, apps, memberships, or recurring services.
              </ThemedText>
            </View>
          ) : (
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
                  onDelete={() => confirmDelete(subscription)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
};

function Field({ label, value, onChangeText, colors, keyboardType = 'default' }: FieldProps) {
  return (
    <View className="mb-3">
      <ThemedText className="mb-1 text-[11px] font-black uppercase" style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        className="h-12 rounded-2xl border px-4 text-sm"
        style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.background }}
      />
    </View>
  );
}

type SegmentedControlProps<T extends string> = {
  label: string;
  values: T[];
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
      <ThemedText className="mb-1 text-[11px] font-black uppercase" style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: colors.background }}>
        {values.map((value) => {
          const selected = value === active;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              className="flex-1 items-center rounded-xl py-2"
              style={{ backgroundColor: selected ? colors.secondary : 'transparent' }}>
              <ThemedText
                className="text-[11px] font-black uppercase"
                style={{ color: selected ? colors.accent : `${colors.text}99` }}>
                {value}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
  onDelete: () => void;
};

function SubscriptionCard({
  subscription,
  selected,
  colors,
  muted,
  onPress,
  onMarkPaid,
  onDelete,
}: SubscriptionCardProps) {
  const urgent = subscription.due_state === 'overdue' || subscription.due_state === 'due_soon';
  const stateLabel = subscription.due_state.replace('_', ' ');
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
            {subscription.category || 'Uncategorized'} · {subscription.billing_interval}
          </ThemedText>
        </View>
        <ThemedText className="text-base font-black" style={{ color: colors.accent }}>
          {formatMoney(subscription.amount)}
        </ThemedText>
      </View>
      <View className="mt-4 flex-row items-center justify-between">
        <View>
          <ThemedText className="text-xs font-bold capitalize" style={{ color: urgent ? '#F57F17' : muted }}>
            {stateLabel}
          </ThemedText>
          <ThemedText className="mt-1 text-[11px]" style={{ color: muted }}>
            Due {subscription.next_due_date}
          </ThemedText>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={onMarkPaid} hitSlop={10}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.accent} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={10}>
            <MaterialCommunityIcons name="trash-can-outline" size={21} color="#D32F2F" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

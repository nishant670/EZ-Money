import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { UpgradeSheet } from '@/components/billing/UpgradeSheet';
import { PanelActionRow } from '@/components/money/PanelActionRow';
import { AppHeader } from '@/components/navigation/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { SkeletonCards, SkeletonFrame } from '@/components/ui/Skeleton';
import { HapticSwitch } from '@/components/ui/HapticSwitch';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useEntitlementGate } from '@/hooks/use-entitlement-gate';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getFriendlyErrorMessage } from '@/lib/api-error';
import {
  Budget,
  createBudget,
  deleteBudget,
  fetchBudgets,
  updateBudget,
} from '@/lib/budgets';
import { categoryVisual } from '@/lib/categories';
import { formatApiDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import { fetchDashboard, type DashboardCategory } from '@/lib/insights';

const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());
const toParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A round number just above what you already spend — a limit worth setting. */
const suggestedLimitFor = (amount: number) => {
  const padded = amount * 1.1;
  const step = padded >= 10000 ? 500 : 100;
  return Math.ceil(padded / step) * step;
};

const monthToDateRange = () => {
  const now = new Date();
  return {
    start: formatApiDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatApiDate(now),
  };
};

export type MoneyPanelProps = {
  /**
   * True inside the Money tab, false on the standalone route the insight and
   * weekly-review screens still deep-link into with prefill params.
   *
   * The difference is only chrome: embedded, the tab already renders the
   * header and owns the back gesture, so the panel contributes an action row
   * instead of a second header stacked under the first.
   */
  embedded?: boolean;
};

export function BudgetsPanel({ embedded = false }: MoneyPanelProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { token } = useAuthStore();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;
  const source = toParam(params.source);
  const budgetId = toParam(params.budgetId);
  const prefillCategory = toParam(params.category);
  const suggestedLimit = toParam(params.suggestedLimit);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [name, setName] = useState('Monthly spending');
  const [category, setCategory] = useState('');
  const [limitAmount, setLimitAmount] = useState('10000');
  const [threshold, setThreshold] = useState('80');
  const [active, setActive] = useState(true);
  const [routePrefillConsumed, setRoutePrefillConsumed] = useState(false);
  const {
    entitlement,
    locked,
    sheetVisible,
    capture: captureEntitlement,
    present: presentUpgrade,
    dismiss: dismissUpgrade,
    clear: clearEntitlement,
  } = useEntitlementGate();
  const [previewCategories, setPreviewCategories] = useState<DashboardCategory[]>([]);

  const formTitle = editing ? 'Edit budget' : 'New monthly budget';
  const submitLabel = editing ? 'Update budget' : 'Create budget';
  const activeBudgets = useMemo(() => budgets.filter((budget) => budget.active).length, [budgets]);

  const editBudget = useCallback((budget: Budget) => {
    setEditing(budget);
    setName(budget.name);
    setCategory(budget.category ?? '');
    setLimitAmount(String(budget.limit_amount));
    setThreshold(String(budget.alert_threshold_percent));
    setActive(budget.active);
    setError(null);
  }, []);

  useEffect(() => {
    if (source !== 'insight' || editing || routePrefillConsumed) return;
    if (budgetId && budgets.length > 0) {
      const matchedBudget = budgets.find((budget) => String(budget.id) === budgetId);
      if (matchedBudget) {
        editBudget(matchedBudget);
        setRoutePrefillConsumed(true);
        return;
      }
    }
    const cleanCategory = prefillCategory?.trim();
    const parsedLimit = parseAmount(suggestedLimit ?? '');
    if (cleanCategory) {
      setName(`${cleanCategory} budget`);
      setCategory(cleanCategory);
    }
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      setLimitAmount(String(Math.ceil(parsedLimit * 1.1)));
    }
    setThreshold('80');
    setActive(true);
    setRoutePrefillConsumed(true);
  }, [budgetId, budgets, editBudget, editing, prefillCategory, routePrefillConsumed, source, suggestedLimit]);

  const resetForm = () => {
    setEditing(null);
    setName('Monthly spending');
    setCategory('');
    setLimitAmount('10000');
    setThreshold('80');
    setActive(true);
    setRoutePrefillConsumed(true);
    setError(null);
  };

  /**
   * Budgets are gated, so the screen has to be able to sell itself with the
   * user's own numbers. The dashboard is not gated and already knows what they
   * spent per category this month.
   */
  const loadPreview = useCallback(async () => {
    if (!token) return;
    const { start, end } = monthToDateRange();
    try {
      const dashboard = await fetchDashboard(token, start, end);
      setPreviewCategories(
        (dashboard.top_categories ?? []).filter((entry) => entry.amount > 0).slice(0, 3)
      );
    } catch {
      // The paywall still stands on its own copy without the numbers.
      setPreviewCategories([]);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) {
      setBudgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBudgets(await fetchBudgets(token));
      clearEntitlement();
    } catch (loadError) {
      // A 402 is an offer, not a failure — no error state, no red text.
      if (captureEntitlement(loadError)) {
        setBudgets([]);
        void loadPreview();
        return;
      }
      setError(getFriendlyErrorMessage(loadError, 'Unable to load budgets right now.'));
    } finally {
      setLoading(false);
    }
  }, [captureEntitlement, clearEntitlement, loadPreview, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const saveBudget = async () => {
    if (!token || saving) return;
    const amount = parseAmount(limitAmount);
    const thresholdValue = Math.round(parseAmount(threshold));
    const nextErrors: string[] = [];

    if (!name.trim()) nextErrors.push('Name is required.');
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.push('Limit must be positive.');
    if (!Number.isInteger(thresholdValue) || thresholdValue < 1 || thresholdValue > 100) {
      nextErrors.push('Alert threshold must be between 1 and 100.');
    }
    if (nextErrors.length > 0) {
      haptics.rejected();
      setError(nextErrors.join('\n'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        limit_amount: amount,
        alert_threshold_percent: thresholdValue,
        active,
      };
      if (editing) {
        await updateBudget(token, editing.id, payload);
      } else {
        await createBudget(token, payload);
      }
      haptics.saved();
      resetForm();
      await load();
    } catch (saveError) {
      if (captureEntitlement(saveError)) {
        presentUpgrade();
        void loadPreview();
        return;
      }
      // A server refusal is the same event to the finger as a missing field —
      // C3's argument for routing both through one rejection, one panel over.
      haptics.rejected();
      setError(getFriendlyErrorMessage(saveError, 'Unable to save this budget.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (budget: Budget) => {
    if (!token) return;
    Alert.alert('Delete budget?', `${budget.name} alerts will stop after deletion.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget(token, budget.id);
            if (editing?.id === budget.id) resetForm();
            await load();
          } catch (deleteError) {
            if (captureEntitlement(deleteError)) {
              presentUpgrade();
              return;
            }
            setError(getFriendlyErrorMessage(deleteError, 'Unable to delete this budget.'));
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {embedded ? (
          <PanelActionRow
            subtitle={
              locked
                ? 'Monthly limits, on the Finnri plan'
                : `${activeBudgets} active monthly limit${activeBudgets === 1 ? '' : 's'}`
            }
            actionLabel={locked ? undefined : 'New budget'}
            onAction={locked ? undefined : resetForm}
            colors={colors}
          />
        ) : (
          <AppHeader
            title="Budget alerts"
            subtitle={locked ? 'On the Finnri plan' : `${activeBudgets} active`}
            onBack={() => router.back()}
            rightIcon={locked ? undefined : 'plus'}
            onRightPress={locked ? undefined : resetForm}
          />
        )}

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: embedded ? 120 : 32,
            gap: 16,
          }}>
          {locked ? (
            <BudgetPaywallPreview
              categories={previewCategories}
              featureLabel={entitlement?.featureLabel ?? 'Budgets'}
              onUpgrade={presentUpgrade}
              colors={colors}
            />
          ) : (
          <View className="rounded-[28px] border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
                  {formTitle}
                </ThemedText>
                <ThemedText className="text-xs" style={{ color: muted }}>
                  INR monthly limit
                </ThemedText>
              </View>
              <HapticSwitch value={active} onValueChange={setActive} />
            </View>

            <BudgetInput label="Name" value={name} onChangeText={setName} colors={colors} />
            <BudgetInput
              label="Category"
              value={category}
              onChangeText={setCategory}
              placeholder="All categories"
              colors={colors}
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <BudgetInput
                  label="Limit"
                  value={limitAmount}
                  onChangeText={(value) => setLimitAmount(value.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  colors={colors}
                />
              </View>
              <View className="w-28">
                <BudgetInput
                  label="Alert %"
                  value={threshold}
                  onChangeText={(value) => setThreshold(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  colors={colors}
                />
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
              onPress={saveBudget}
              disabled={saving}
              className="h-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <ThemedText className="text-sm font-black" style={{ color: 'white' }}>
                  {submitLabel}
                </ThemedText>
              )}
            </Pressable>
          </View>
          )}

          {locked ? null : loading ? (
            <SkeletonFrame label="Loading budgets" testID="budgets-skeleton">
              <SkeletonCards count={3} lines={2} radius={28} />
            </SkeletonFrame>
          ) : budgets.length === 0 ? (
            <View className="items-center rounded-[28px] border p-8" style={{ borderColor: colors.border }}>
              <MaterialCommunityIcons name="chart-donut" size={36} color={colors.accent} />
              <ThemedText className="mt-3 text-center text-sm font-black">
                No budgets yet
              </ThemedText>
              <ThemedText className="mt-1 text-center text-xs" style={{ color: muted }}>
                Create one to receive monthly threshold alerts.
              </ThemedText>
            </View>
          ) : (
            <View className="gap-3">
              {budgets.map((budget) => (
                <Pressable
                  key={budget.id}
                  onPress={() => editBudget(budget)}
                  className="rounded-[28px] border p-4"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: editing?.id === budget.id ? colors.accent : colors.border,
                  }}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <ThemedText className="text-base font-black" style={{ fontFamily: Fonts.title }}>
                        {budget.name}
                      </ThemedText>
                      <ThemedText className="mt-1 text-xs" style={{ color: muted }}>
                        {budget.category ? budget.category : 'All categories'} · alert at{' '}
                        {budget.alert_threshold_percent}%
                      </ThemedText>
                    </View>
                    <ThemedText className="text-base font-black" style={{ color: colors.accent }}>
                      {formatMoney(budget.limit_amount)}
                    </ThemedText>
                  </View>
                  <View className="mt-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: budget.active ? '#2E7D32' : '#9E9E9E' }}
                      />
                      <ThemedText className="text-xs font-bold" style={{ color: muted }}>
                        {budget.active ? 'Active' : 'Paused'}
                      </ThemedText>
                    </View>
                    <Pressable onPress={() => confirmDelete(budget)} hitSlop={10}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#D32F2F" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <UpgradeSheet visible={sheetVisible} entitlement={entitlement} onClose={dismissUpgrade} />
    </View>
  );
}

type BudgetPaywallPreviewProps = {
  categories: DashboardCategory[];
  featureLabel: string;
  onUpgrade: () => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

/**
 * What stands in for the create form when budgets are locked. A form you
 * cannot submit teaches nothing; the user's own spend does — every row here is
 * a limit they could plausibly set, priced off what they actually spent this
 * month.
 */
function BudgetPaywallPreview({
  categories,
  featureLabel,
  onUpgrade,
  colors,
}: BudgetPaywallPreviewProps) {
  const muted = `${colors.text}99`;
  const lead = categories[0];

  return (
    <View
      className="rounded-[28px] border p-5"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.accent}1F` }}>
          <MaterialCommunityIcons name="chart-donut" size={22} color={colors.accent} />
        </View>
        <View className="flex-1">
          <ThemedText className="text-lg font-black" style={{ fontFamily: Fonts.title }}>
            {featureLabel}
          </ThemedText>
          <ThemedText className="text-xs" style={{ color: muted }}>
            Included with the Finnri plan
          </ThemedText>
        </View>
      </View>

      <ThemedText className="mt-4 text-sm" style={{ lineHeight: 20 }}>
        {lead
          ? `Set a limit on ${lead.category} — you spent ${formatMoney(lead.amount)} this month.`
          : 'Set a monthly limit and hear about it before you cross it, not after.'}
      </ThemedText>

      {categories.length > 0 && (
        <View className="mt-4 gap-2">
          {categories.map((entry) => {
            const visual = categoryVisual(entry.category);
            const suggestion = suggestedLimitFor(entry.amount);
            return (
              <View
                key={entry.category}
                className="flex-row items-center gap-3 rounded-2xl px-3 py-3"
                style={{ backgroundColor: colors.background }}>
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: visual.bgColor }}>
                  <MaterialCommunityIcons name={visual.icon} size={18} color={visual.color} />
                </View>
                <View className="flex-1">
                  <ThemedText className="text-sm font-black">{entry.category}</ThemedText>
                  <ThemedText className="text-xs" style={{ color: muted }}>
                    {formatMoney(entry.amount)} this month
                  </ThemedText>
                </View>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: `${colors.accent}1F` }}>
                  <ThemedText className="text-xs font-black" style={{ color: colors.accent }}>
                    {formatMoney(suggestion)} limit
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onUpgrade}
        className="mt-5 items-center justify-center rounded-2xl"
        style={{ backgroundColor: colors.accent, minHeight: 52 }}>
        <ThemedText className="text-sm font-black" style={{ color: 'white' }}>
          Unlock {featureLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

type BudgetInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  colors: ReturnType<typeof useThemeTokens>['colors'];
};

function BudgetInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  colors,
}: BudgetInputProps) {
  return (
    <View className="mb-3">
      <ThemedText className="mb-1 text-[11px] font-black uppercase" style={{ color: `${colors.text}99` }}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${colors.text}66`}
        keyboardType={keyboardType}
        className="h-12 rounded-2xl border px-4 text-sm"
        style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.background }}
      />
    </View>
  );
}

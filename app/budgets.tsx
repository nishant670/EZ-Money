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
import {
  Budget,
  createBudget,
  deleteBudget,
  fetchBudgets,
  updateBudget,
} from '@/lib/budgets';

const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());
const formatAmount = (value: number | string) =>
  Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
  });

export default function BudgetsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;

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

  const formTitle = editing ? 'Edit budget' : 'New monthly budget';
  const submitLabel = editing ? 'Update budget' : 'Create budget';
  const activeBudgets = useMemo(() => budgets.filter((budget) => budget.active).length, [budgets]);

  const resetForm = () => {
    setEditing(null);
    setName('Monthly spending');
    setCategory('');
    setLimitAmount('10000');
    setThreshold('80');
    setActive(true);
    setError(null);
  };

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load budgets right now.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const editBudget = (budget: Budget) => {
    setEditing(budget);
    setName(budget.name);
    setCategory(budget.category ?? '');
    setLimitAmount(String(budget.limit_amount));
    setThreshold(String(budget.alert_threshold_percent));
    setActive(budget.active);
    setError(null);
  };

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
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this budget.');
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
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this budget.');
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
        <AppHeader
          title="Budget alerts"
          subtitle={`${activeBudgets} active`}
          onBack={() => router.back()}
          rightIcon="plus"
          onRightPress={resetForm}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 16 }}>
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
              <Switch value={active} onValueChange={setActive} />
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

          {loading ? (
            <ActivityIndicator color={colors.accent} />
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
                      ₹{formatAmount(budget.limit_amount)}
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
    </SafeAreaView>
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

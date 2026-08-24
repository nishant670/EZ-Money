import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarCircle, GroupChoiceChip } from '@/components/split/primitives/SplitPrimitives';
import {
  formatApiDate,
  formatBalance,
  parseAmount,
  parseApiDate,
} from '@/components/split/split-utils';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  computeSplitShares,
  describeSplitTab,
  splitParticipantKeys,
  sumSplitWeights,
  type AdjustSplitTab,
  type SplitSelection,
  type SplitSlotPerson,
} from '@/lib/split-preferences';
import type { SplitGroup } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export type ExpenseFlowScreen = 'expense' | 'split_choice' | 'adjust_split';

function describeSplitChoice(selection: SplitSelection, people: SplitSlotPerson[]) {
  const payerLabel =
    selection.payerKey === selection.selfKey
      ? 'you'
      : (people.find((person) => person.key === selection.payerKey)?.label ?? 'a friend');
  if (selection.fullAmount) {
    return selection.payerKey === selection.selfKey
      ? 'You are owed the full amount.'
      : `${payerLabel} is owed the full amount.`;
  }
  const tabLabel = describeSplitTab(selection.tab);
  return selection.payerKey === selection.selfKey
    ? `Paid by you and ${tabLabel}.`
    : `${payerLabel} paid, ${tabLabel}.`;
}

export function AddExpenseModal({
  visible,
  flowScreen,
  saving,
  errorMessage,
  title,
  amount,
  date,
  notes,
  groups,
  selectedGroup,
  selectedGroupId,
  isGroupLocked,
  people,
  selection,
  onChangeTitle,
  onChangeAmount,
  onChangeDate,
  onChangeNotes,
  onSelectGroup,
  onChangeFlowScreen,
  onSelectPayer,
  onToggleParticipant,
  onToggleAllParticipants,
  onChangeAdjustSplitTab,
  onChangeSplitWeight,
  onApplySplit,
  onSave,
  onClose,
}: {
  visible: boolean;
  flowScreen: ExpenseFlowScreen;
  saving: boolean;
  errorMessage?: string | null;
  title: string;
  amount: string;
  date: string;
  notes: string;
  groups: SplitGroup[];
  selectedGroup: SplitGroup | null;
  selectedGroupId: number | null;
  isGroupLocked: boolean;
  people: SplitSlotPerson[];
  selection: SplitSelection;
  onChangeTitle: (value: string) => void;
  onChangeAmount: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onSelectGroup: (groupId: number | null) => void;
  onChangeFlowScreen: (screen: ExpenseFlowScreen) => void;
  onSelectPayer: (payerKey: string, fullAmount: boolean) => void;
  onToggleParticipant: (key: string) => void;
  onToggleAllParticipants: () => void;
  onChangeAdjustSplitTab: (tab: AdjustSplitTab) => void;
  onChangeSplitWeight: (key: string, value: string) => void;
  onApplySplit: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const theme = useThemeTokens().colors;
  const groupLabel = selectedGroup ? `All of ${selectedGroup.name}` : 'All friends';
  const splitLabel = describeSplitChoice(selection, people);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        {flowScreen === 'expense' ? (
          <View className="flex-1">
            <ExpenseTopBar title="Add expense" saving={saving} onBack={onClose} onDone={onSave} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 110 }}>
              {!isGroupLocked ? (
                <View
                  className="min-h-[74px] flex-row items-center border-b px-6"
                  style={{ borderColor: theme.border }}>
                  <TText className="text-xl" style={{ color: theme.text }}>
                    With you and:
                  </TText>
                  <Pressable
                    accessibilityRole="button"
                    className="ml-3 min-h-12 flex-1 flex-row items-center rounded-full border px-3"
                    style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.accent }}>
                      <MaterialCommunityIcons
                        name="receipt-text-outline"
                        size={23}
                        color={theme.onAccent}
                      />
                    </View>
                    <TText
                      className="ml-3 flex-1 text-lg"
                      numberOfLines={1}
                      style={{ color: theme.text, fontFamily: Fonts.title }}>
                      {groupLabel}
                    </TText>
                  </Pressable>
                </View>
              ) : null}

              <View className="px-8 pt-12">
                <View className="flex-row items-center gap-4">
                  <View
                    className="h-[70px] w-[70px] items-center justify-center rounded border"
                    style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <MaterialCommunityIcons
                      name="receipt-text-outline"
                      size={40}
                      color={theme.text}
                    />
                  </View>
                  <TextInput
                    value={title}
                    onChangeText={onChangeTitle}
                    placeholder="Description"
                    placeholderTextColor={`${theme.text}B8`}
                    style={{
                      flex: 1,
                      minHeight: 58,
                      borderBottomWidth: 1,
                      borderColor: `${theme.text}8C`,
                      color: theme.text,
                      fontFamily: Fonts.body,
                      fontSize: 20,
                    }}
                  />
                </View>
                <View className="mt-6 flex-row items-center gap-4">
                  <View
                    className="h-[70px] w-[70px] items-center justify-center rounded border"
                    style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <TText variant="amount" style={{ color: theme.text }}>
                      {CURRENCY_SYMBOL}
                    </TText>
                  </View>
                  <TextInput
                    value={amount}
                    onChangeText={onChangeAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={`${theme.text}B8`}
                    style={{
                      flex: 1,
                      minHeight: 64,
                      borderBottomWidth: 2,
                      borderColor: theme.accent,
                      color: theme.text,
                      fontFamily: Fonts.title,
                      fontSize: 36,
                    }}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onChangeFlowScreen('split_choice')}
                  className="mt-10 min-h-14 items-center justify-center self-center rounded border px-6"
                  style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  <TText variant="cardTitle" style={{ color: theme.text }}>
                    {splitLabel}
                  </TText>
                </Pressable>

                {!isGroupLocked && groups.length > 0 ? (
                  <View className="mt-8">
                    <TText className="text-xs text-black/55 dark:text-white/55">Group</TText>
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <GroupChoiceChip
                        label="No group"
                        selected={selectedGroupId === null}
                        onPress={() => onSelectGroup(null)}
                      />
                      {groups.map((group) => (
                        <GroupChoiceChip
                          key={group.id}
                          label={group.name}
                          selected={selectedGroupId === group.id}
                          onPress={() => onSelectGroup(group.id)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {errorMessage ? (
                  <ErrorBanner message={errorMessage} style={{ marginTop: 24 }} />
                ) : null}
              </View>
            </ScrollView>
            <ExpenseBottomBar date={date} onChangeDate={onChangeDate} />
          </View>
        ) : flowScreen === 'split_choice' ? (
          <SplitChoiceScreen
            people={people}
            selection={selection}
            onBack={() => onChangeFlowScreen('expense')}
            onSelectPayer={onSelectPayer}
            onMoreOptions={() => onChangeFlowScreen('adjust_split')}
          />
        ) : (
          <AdjustSplitScreen
            people={people}
            selection={selection}
            amount={parseAmount(amount)}
            errorMessage={errorMessage}
            onBack={() => onChangeFlowScreen('split_choice')}
            onDone={onApplySplit}
            onSelectPayer={onSelectPayer}
            onToggleParticipant={onToggleParticipant}
            onToggleAll={onToggleAllParticipants}
            onChangeTab={onChangeAdjustSplitTab}
            onChangeWeight={onChangeSplitWeight}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function ExpenseTopBar({
  title,
  saving,
  onBack,
  onDone,
}: {
  title: string;
  saving: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View
      className="min-h-16 flex-row items-center border-b px-5"
      style={{ borderColor: theme.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close expense"
        onPress={onBack}
        className="h-11 w-11 items-center justify-center">
        <MaterialCommunityIcons name="arrow-left" size={28} color={theme.text} />
      </Pressable>
      <TText variant="screenTitle" className="ml-4 flex-1" style={{ color: theme.text }}>
        {title}
      </TText>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={onDone}
        className="h-11 w-11 items-center justify-center">
        {saving ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <MaterialCommunityIcons name="check" size={30} color={theme.text} />
        )}
      </Pressable>
    </View>
  );
}

function ExpenseBottomBar({
  date,
  onChangeDate,
}: {
  date: string;
  onChangeDate: (value: string) => void;
}) {
  const theme = useThemeTokens().colors;
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const openDatePicker = () => {
    const currentDate = parseApiDate(date);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        onValueChange: (_event, selectedDate) => {
          if (selectedDate) {
            onChangeDate(formatApiDate(selectedDate));
          }
        },
        onDismiss: () => undefined,
      });
      return;
    }
    setShowIosDatePicker((current) => !current);
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 min-h-20 border-t px-6 pb-3"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="min-h-16 flex-row items-center justify-between">
        <TText className="text-base text-black/55 dark:text-white/55">{date}</TText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select expense date"
          onPress={openDatePicker}
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.secondary }}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={30} color={theme.accent} />
        </Pressable>
      </View>
      {showIosDatePicker ? (
        <DateTimePicker
          value={parseApiDate(date)}
          mode="date"
          display="spinner"
          onValueChange={(_event, selectedDate) => {
            if (selectedDate) {
              onChangeDate(formatApiDate(selectedDate));
            }
          }}
          onDismiss={() => setShowIosDatePicker(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * The four shapes a split usually takes, offered before the full editor. Which
 * "friend paid" it names is whoever is currently the payer, falling back to the
 * first other person in the group.
 */
export function SplitChoiceScreen({
  people,
  selection,
  title,
  onBack,
  onDone,
  onSelectPayer,
  onMoreOptions,
}: {
  people: SplitSlotPerson[];
  selection: SplitSelection;
  title?: string;
  onBack: () => void;
  onDone?: () => void;
  onSelectPayer: (payerKey: string, fullAmount: boolean) => void;
  onMoreOptions: () => void;
}) {
  const theme = useThemeTokens().colors;
  const selfPerson = people.find((person) => person.key === selection.selfKey);
  const selfName = selfPerson?.label ?? 'You';
  const others = people.filter((person) => person.key !== selection.selfKey);
  const activeOther =
    others.find((person) => person.key === selection.payerKey) ?? others[0] ?? null;
  const otherName = activeOther?.label ?? 'Friend';
  const choices: { key: string; payerKey: string; fullAmount: boolean; label: string }[] = [
    {
      key: 'self_equal',
      payerKey: selection.selfKey,
      fullAmount: false,
      label: 'You paid, split equally.',
    },
    {
      key: 'self_full',
      payerKey: selection.selfKey,
      fullAmount: true,
      label: 'You are owed the full amount.',
    },
    ...(activeOther
      ? [
          {
            key: 'other_equal',
            payerKey: activeOther.key,
            fullAmount: false,
            label: `${otherName} paid, split equally.`,
          },
          {
            key: 'other_full',
            payerKey: activeOther.key,
            fullAmount: true,
            label: `${otherName} is owed the full amount.`,
          },
        ]
      : []),
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <ExpenseTopBar
        title={title ?? 'How was this expense split?'}
        saving={false}
        onBack={onBack}
        onDone={onDone ?? onBack}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-5">
          {choices.map((choice) => {
            const selected =
              selection.payerKey === choice.payerKey && selection.fullAmount === choice.fullAmount;
            const paidBySelf = choice.payerKey === selection.selfKey;
            return (
              <Pressable
                key={choice.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectPayer(choice.payerKey, choice.fullAmount)}
                className="min-h-[92px] flex-row items-center gap-5">
                <SplitAvatarStack
                  primaryLabel={paidBySelf ? selfName : otherName}
                  secondaryLabel={paidBySelf ? otherName : selfName}
                  tone={paidBySelf ? 'green' : 'orange'}
                />
                <TText
                  className="flex-1 text-xl"
                  style={{ color: theme.text, fontFamily: Fonts.body }}>
                  {choice.label}
                </TText>
                {selected ? (
                  <MaterialCommunityIcons name="check" size={30} color={theme.text} />
                ) : null}
              </Pressable>
            );
          })}

          {others.length > 1 ? (
            <View className="mt-2">
              <TText className="mb-2 text-sm text-black/55 dark:text-white/55">
                Paid by someone else
              </TText>
              <View className="flex-row flex-wrap gap-2">
                {others.map((person) => (
                  <GroupChoiceChip
                    key={person.key}
                    label={person.label}
                    selected={selection.payerKey === person.key}
                    onPress={() => onSelectPayer(person.key, selection.fullAmount)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onMoreOptions}
            className="mt-12 min-h-14 items-center justify-center self-center rounded border px-8"
            style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <TText variant="button" style={{ color: theme.text }}>
              More options
            </TText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SplitAvatarStack({
  primaryLabel,
  secondaryLabel,
  tone,
}: {
  primaryLabel: string;
  secondaryLabel: string;
  tone: 'green' | 'orange';
}) {
  const theme = useThemeTokens().colors;
  const primaryColor = tone === 'green' ? theme.positive : theme.accent;
  return (
    <View className="h-12 w-[82px] flex-row items-center">
      <AvatarCircle label={primaryLabel} size={48} borderColor={primaryColor} />
      <View style={{ marginLeft: -18 }}>
        <AvatarCircle label={secondaryLabel} size={42} borderColor={theme.onAccent} />
      </View>
    </View>
  );
}

const splitTabCopy: Record<AdjustSplitTab, { heading: string; caption: string }> = {
  equally: { heading: 'Split equally', caption: 'Select which people owe an equal share.' },
  unequally: {
    heading: 'Split by exact amounts',
    caption: 'Enter what each person owes. The amounts must add up to the total.',
  },
  percentages: {
    heading: 'Split by percentages',
    caption: 'Enter each share as a percentage. They must add up to 100%.',
  },
  shares: {
    heading: 'Split by shares',
    caption: 'Enter how many shares each person carries. Two shares owe twice one.',
  },
};

export function AdjustSplitScreen({
  people,
  selection,
  amount,
  variant = 'expense',
  title,
  errorMessage,
  onBack,
  onDone,
  onSelectPayer,
  onToggleParticipant,
  onToggleAll,
  onChangeTab,
  onChangeWeight,
}: {
  people: SplitSlotPerson[];
  selection: SplitSelection;
  amount: number;
  /**
   * A group default is written before any amount exists, so the exact-amounts
   * tab has nothing to divide and the rupee previews have nothing to show.
   */
  variant?: 'expense' | 'default';
  title?: string;
  errorMessage?: string | null;
  onBack: () => void;
  onDone: () => void;
  onSelectPayer: (payerKey: string, fullAmount: boolean) => void;
  onToggleParticipant: (key: string) => void;
  onToggleAll: () => void;
  onChangeTab: (tab: AdjustSplitTab) => void;
  onChangeWeight: (key: string, value: string) => void;
}) {
  const theme = useThemeTokens().colors;
  const [payerPickerVisible, setPayerPickerVisible] = useState(false);
  const isDefaultVariant = variant === 'default';
  const activeTab = selection.tab;
  const payerName =
    people.find((person) => person.key === selection.payerKey)?.label ?? 'Somebody';
  const activeKeys = splitParticipantKeys(selection);
  const shareResult = computeSplitShares({
    amount,
    tab: activeTab,
    keys: activeKeys,
    weights: selection.weights,
  });
  const shares = shareResult.ok ? shareResult.shares : {};
  const totalSelected = activeKeys.length;
  const perPerson =
    Number.isFinite(amount) && amount > 0 && totalSelected > 0 ? amount / totalSelected : 0;
  const allSelected = people.every((person) => selection.participantKeys.includes(person.key));
  const weightTotal = sumSplitWeights(activeKeys, selection.weights);
  const tabs: { key: AdjustSplitTab; label: string }[] = [
    { key: 'equally', label: 'Equally' },
    ...(isDefaultVariant
      ? []
      : ([{ key: 'unequally', label: 'Unequally' }] as { key: AdjustSplitTab; label: string }[])),
    { key: 'percentages', label: 'By percentages' },
    { key: 'shares', label: 'By shares' },
  ];
  const copy = splitTabCopy[activeTab];

  const renderPersonRow = (person: SplitSlotPerson) => {
    const included = activeKeys.includes(person.key);
    if (activeTab === 'equally') {
      return (
        <SplitPersonRow
          key={person.key}
          label={person.label}
          subtitle={person.subtitle}
          selected={included}
          onPress={() => onToggleParticipant(person.key)}
        />
      );
    }
    return (
      <SplitWeightRow
        key={person.key}
        label={person.label}
        subtitle={person.subtitle}
        selected={included}
        value={selection.weights[person.key] ?? ''}
        prefix={activeTab === 'unequally' ? CURRENCY_SYMBOL : ''}
        suffix={activeTab === 'percentages' ? '%' : ''}
        placeholder={activeTab === 'shares' ? '1' : '0'}
        preview={
          isDefaultVariant || !included || !shareResult.ok
            ? null
            : formatBalance(shares[person.key] ?? 0)
        }
        onPress={() => onToggleParticipant(person.key)}
        onChangeValue={(value) => onChangeWeight(person.key, value)}
      />
    );
  };

  const footerSummary = () => {
    if (activeTab === 'equally') {
      return isDefaultVariant
        ? `Equal share between ${totalSelected} ${totalSelected === 1 ? 'person' : 'people'}`
        : `${formatBalance(perPerson)}/person`;
    }
    if (activeTab === 'percentages') return `${weightTotal.toFixed(2)}% of 100%`;
    if (activeTab === 'shares') return `${weightTotal} ${weightTotal === 1 ? 'share' : 'shares'}`;
    return `${formatBalance(weightTotal)} of ${formatBalance(amount)}`;
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <ExpenseTopBar
        title={title ?? 'Adjust split'}
        saving={false}
        onBack={onBack}
        onDone={onDone}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}>
        <View className="flex-row items-center gap-4 px-6 py-5">
          <AvatarCircle label={payerName} size={52} />
          <TText className="flex-1 text-xl" style={{ color: theme.text }}>
            Paid by <TText style={{ fontFamily: Fonts.title }}>{payerName}</TText>
          </TText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change who paid"
            onPress={() => setPayerPickerVisible(true)}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="pencil" size={26} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b"
          style={{ borderColor: theme.border }}
          contentContainerStyle={{ paddingHorizontal: 20 }}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onChangeTab(tab.key)}
                className="min-h-14 justify-center px-4"
                style={{ borderBottomWidth: selected ? 2 : 0, borderColor: theme.text }}>
                <TText
                  className="text-lg"
                  style={{
                    color: selected ? theme.text : `${theme.text}B8`,
                    fontFamily: Fonts.title,
                  }}>
                  {tab.label}
                </TText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="items-center px-6 py-8">
          {activeTab === 'equally' ? (
            <View className="flex-row items-end gap-6">
              <MaterialCommunityIcons name="cash-multiple" size={72} color={theme.accent} />
              <MaterialCommunityIcons name="elephant" size={74} color={`${theme.accent}D9`} />
              <MaterialCommunityIcons name="heart" size={64} color={`${theme.accent}B8`} />
              <MaterialCommunityIcons name="glass-cocktail" size={66} color={`${theme.accent}99`} />
            </View>
          ) : (
            <MaterialCommunityIcons
              name={activeTab === 'percentages' ? 'percent-outline' : 'scale-balance'}
              size={64}
              color={theme.accent}
            />
          )}
          <TText variant="screenTitle" className="mt-7" style={{ color: theme.text }}>
            {copy.heading}
          </TText>
          <TText className="mt-2 text-center text-lg text-black/55 dark:text-white/55">
            {copy.caption}
          </TText>
          {selection.fullAmount ? (
            <TText className="mt-3 text-center text-base text-black/50 dark:text-white/50">
              {payerName} is owed the full amount and carries none of it.
            </TText>
          ) : null}
        </View>

        {errorMessage ? (
          <ErrorBanner message={errorMessage} style={{ marginHorizontal: 24, marginBottom: 16 }} />
        ) : null}

        <View className="px-6">{people.map(renderPersonRow)}</View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 min-h-[88px] flex-row items-center border-t"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="flex-1 items-center px-3">
          <TText
            className="text-center text-lg"
            style={{ color: theme.text, fontFamily: Fonts.title }}>
            {footerSummary()}
          </TText>
          <TText className="mt-1 text-center text-base text-black/55 dark:text-white/55">
            {shareResult.ok || activeTab === 'equally'
              ? `(${totalSelected} ${totalSelected === 1 ? 'person' : 'people'})`
              : shareResult.error}
          </TText>
        </View>
        <View className="h-full w-px" style={{ backgroundColor: theme.border }} />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allSelected }}
          onPress={onToggleAll}
          className="min-h-[88px] w-40 flex-row items-center justify-center gap-4">
          <TText variant="screenTitle" style={{ color: theme.text }}>
            All
          </TText>
          <MaterialCommunityIcons
            name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={30}
            color={allSelected ? theme.accent : `${theme.text}CC`}
          />
        </Pressable>
      </View>

      <AnimatedBottomSheet visible={payerPickerVisible} onClose={() => setPayerPickerVisible(false)}>
        <View
          className="rounded-t-[28px] border px-5 pb-8 pt-5"
          style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <View className="mb-4 flex-row items-center justify-between">
            <TText variant="sectionTitle" style={{ color: theme.text }}>
              Paid by
            </TText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPayerPickerVisible(false)}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.secondary }}>
              <MaterialCommunityIcons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>
          <View className="gap-2">
            {people.map((person) => (
              <PayerOptionRow
                key={person.key}
                label={person.label}
                subtitle={person.subtitle}
                selected={selection.payerKey === person.key}
                onPress={() => {
                  onSelectPayer(person.key, selection.fullAmount);
                  setPayerPickerVisible(false);
                }}
              />
            ))}
          </View>
        </View>
      </AnimatedBottomSheet>
    </View>
  );
}

function PayerOptionRow({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-4 rounded-2xl px-3"
      style={{ backgroundColor: selected ? theme.secondary : 'transparent' }}>
      <AvatarCircle label={label} size={44} />
      <View className="flex-1">
        <TText variant="cardTitle" style={{ color: theme.text }}>
          {label}
        </TText>
        {subtitle ? (
          <TText className="mt-1 text-xs text-black/50 dark:text-white/50" numberOfLines={1}>
            {subtitle}
          </TText>
        ) : null}
      </View>
      {selected ? <MaterialCommunityIcons name="check" size={22} color={theme.accent} /> : null}
    </Pressable>
  );
}

function SplitPersonRow({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="min-h-[88px] flex-row items-center gap-5">
      <AvatarCircle label={label} size={54} />
      <View className="flex-1">
        <TText variant="screenTitle" style={{ color: theme.text }}>
          {label}
        </TText>
        {subtitle ? (
          <TText className="mt-1 text-sm text-black/50 dark:text-white/50" numberOfLines={1}>
            {subtitle}
          </TText>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={30}
        color={selected ? theme.accent : `${theme.text}CC`}
      />
    </Pressable>
  );
}

/**
 * The weighted counterpart to `SplitPersonRow`. The checkbox still decides who
 * is in the split — the field only says how heavily they carry it — so the two
 * rows stay interchangeable as the tab changes under them.
 */
function SplitWeightRow({
  label,
  subtitle,
  selected,
  value,
  prefix,
  suffix,
  placeholder,
  preview,
  onPress,
  onChangeValue,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  value: string;
  prefix: string;
  suffix: string;
  placeholder: string;
  preview: string | null;
  onPress: () => void;
  onChangeValue: (value: string) => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="min-h-[88px] flex-row items-center gap-4">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Include ${label} in this split`}
        onPress={onPress}
        className="flex-1 flex-row items-center gap-4">
        <AvatarCircle label={label} size={54} />
        <View className="flex-1">
          <TText variant="screenTitle" style={{ color: theme.text }}>
            {label}
          </TText>
          {preview ? (
            <TText className="mt-1 text-base" style={{ color: theme.accent }}>
              {preview}
            </TText>
          ) : subtitle ? (
            <TText className="mt-1 text-sm text-black/50 dark:text-white/50" numberOfLines={1}>
              {subtitle}
            </TText>
          ) : null}
        </View>
      </Pressable>
      <View
        className="min-h-12 w-28 flex-row items-center rounded-xl border px-3"
        style={{
          backgroundColor: selected ? theme.card : 'transparent',
          borderColor: selected ? theme.border : `${theme.text}40`,
          opacity: selected ? 1 : 0.45,
        }}>
        {prefix ? (
          <TText className="mr-1 text-lg" style={{ color: theme.text }}>
            {prefix}
          </TText>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          editable={selected}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={`${theme.text}B3`}
          accessibilityLabel={`Split value for ${label}`}
          style={{
            flex: 1,
            minHeight: 48,
            textAlign: 'right',
            color: theme.text,
            fontFamily: Fonts.title,
            fontSize: 18,
          }}
        />
        {suffix ? (
          <TText className="ml-1 text-lg" style={{ color: theme.text }}>
            {suffix}
          </TText>
        ) : null}
      </View>
    </View>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AvatarCircle,
  PrimaryModalButton,
} from '@/components/split/primitives/SplitPrimitives';
import {
  formatBalance,
  getGroupBalanceRows,
  getGroupTotals,
} from '@/components/split/split-utils';
import type { GroupActionMode, SplitGroupSummary } from '@/components/split/split-types';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { StateView } from '@/components/ui/StateView';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SplitFriend } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export function GroupActionModal({
  summary: liveSummary,
  mode: liveMode,
  friends,
  currentUserName,
  onClose,
  onSettleWithFriend,
  onShareExport,
}: {
  summary: SplitGroupSummary | null;
  mode: GroupActionMode | null;
  friends: SplitFriend[];
  currentUserName: string;
  onClose: () => void;
  onSettleWithFriend: (summary: SplitGroupSummary, friendId: number, balance: number) => void;
  onShareExport: (summary: SplitGroupSummary) => void;
}) {
  const theme = useThemeTokens().colors;
  const presentationRef = useRef<{
    summary: SplitGroupSummary;
    mode: GroupActionMode;
  } | null>(null);
  if (liveSummary && liveMode) {
    presentationRef.current = { summary: liveSummary, mode: liveMode };
  }
  const presentation = presentationRef.current;
  if (!presentation) return null;
  const { summary, mode } = presentation;

  const balances = getGroupBalanceRows(summary, friends);
  const totals = getGroupTotals(summary, friends, currentUserName);
  const openBalances = balances.filter((row) => row.balance !== 0);
  const title =
    mode === 'settle'
      ? 'Settle up'
      : mode === 'totals'
        ? 'Totals'
        : mode === 'balances'
          ? 'Balances'
          : 'Export';

  return (
    <AnimatedBottomSheet
      visible={Boolean(liveSummary && liveMode)}
      onClose={onClose}
      sheetStyle={{ maxHeight: '92%' }}>
      <View
        className="overflow-hidden rounded-t-[28px] border"
        style={{ backgroundColor: theme.background, borderColor: theme.border, flexShrink: 1 }}>
        <View className="min-h-16 flex-row items-center border-b px-5" style={{ borderColor: theme.border }}>
          <View className="flex-1">
            <TText variant="screenTitle" style={{ color: theme.text }}>
              {title}
            </TText>
            <TText className="mt-1 text-xs text-black/50 dark:text-white/50">
              {summary.group.name}
            </TText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 44 }}>
          {mode === 'settle' ? (
            <View>
              <TText variant="screenTitle" style={{ color: theme.text }}>
                Outstanding balances
              </TText>
              <TText className="mt-2 text-sm leading-5 text-black/55 dark:text-white/55">
                Pick a balance to record the settlement direction and amount automatically.
              </TText>
              <View className="mt-6 gap-3">
                {openBalances.length > 0 ? (
                  openBalances.map((row) => (
                    <GroupBalanceActionRow
                      key={row.friend.id}
                      friend={row.friend}
                      balance={row.balance}
                      actionLabel="Record payment"
                      onPress={() => onSettleWithFriend(summary, row.friend.id, row.balance)}
                    />
                  ))
                ) : (
                  <StateView
                    compact
                    icon="check-circle-outline"
                    title="Settled up"
                    message="There are no open balances in this group."
                  />
                )}
              </View>
            </View>
          ) : null}

          {mode === 'totals' ? (
            <View>
              <View className="gap-3">
                <GroupMetricRow label="Total expenses" value={formatBalance(totals.total)} icon="receipt-text-outline" />
                <GroupMetricRow label="You paid" value={formatBalance(totals.youPaid)} icon="wallet-outline" />
                <GroupMetricRow label="Friends paid" value={formatBalance(totals.friendPaid)} icon="account-cash-outline" />
                <GroupMetricRow label="You lent" value={formatBalance(totals.youLent)} icon="arrow-up-circle-outline" positive />
                <GroupMetricRow label="You borrowed" value={formatBalance(totals.youBorrowed)} icon="arrow-down-circle-outline" negative />
              </View>
              <TText variant="sectionTitle" className="mt-8" style={{ color: theme.text }}>
                Paid by
              </TText>
              <View className="mt-3 gap-2">
                {[...totals.payers.entries()].map(([name, value]) => (
                  <View
                    key={name}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                    style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
                    <TText variant="cardTitle" style={{ color: theme.text }}>
                      {name}
                    </TText>
                    <TText variant="cardTitle" style={{ color: theme.text }}>
                      {formatBalance(value)}
                    </TText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'balances' ? (
            <View>
              <TText variant="screenTitle" style={{ color: theme.text }}>
                Group balances
              </TText>
              <View className="mt-5 gap-3">
                {balances.map((row) => (
                  <GroupBalanceActionRow
                    key={row.friend.id}
                    friend={row.friend}
                    balance={row.balance}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'export' ? (
            <View>
              <View
                className="rounded-2xl border p-5"
                style={{ backgroundColor: theme.secondary, borderColor: theme.border }}>
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: theme.accent }}>
                    <MaterialCommunityIcons name="table-large" size={25} color={theme.onAccent} />
                  </View>
                  <View className="flex-1">
                    <TText
                      className="text-xl"
                      style={{ color: theme.text, fontFamily: Fonts.title }}>
                      Finnri split export
                    </TText>
                    <TText className="mt-1 text-sm text-black/55 dark:text-white/55">
                      Excel-compatible CSV report
                    </TText>
                  </View>
                </View>
                <TText className="mt-4 text-sm leading-5 text-black/60 dark:text-white/60">
                  A simple spreadsheet with who owes whom at the top, followed by every expense,
                  who paid, who it was split with, and each person&apos;s share.
                </TText>
              </View>
              <View
                className="mt-6 rounded-2xl border p-4"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                <ExportPreviewRow label="Format" value=".csv for Excel, Numbers, Google Sheets" />
                <ExportPreviewRow label="Currency" value="INR numeric amounts" />
                <ExportPreviewRow label="Top section" value="Who owes whom" />
                <ExportPreviewRow label="Expense section" value="Paid by, split with, shares" />
              </View>
              <PrimaryModalButton
                label="Share CSV export"
                loading={false}
                onPress={() => onShareExport(summary)}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AnimatedBottomSheet>
  );
}

function GroupMetricRow({
  label,
  value,
  icon,
  positive,
  negative,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  positive?: boolean;
  negative?: boolean;
}) {
  const theme = useThemeTokens().colors;
  const color = positive ? theme.positive : negative ? theme.negative : theme.neutral;
  return (
    <View
      className="min-h-16 flex-row items-center gap-4 rounded-2xl border px-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <TText variant="cardTitle" className="flex-1" style={{ color: theme.text }}>
        {label}
      </TText>
      <TText variant="cardTitle" style={{ color }}>
        {value}
      </TText>
    </View>
  );
}

function ExportPreviewRow({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens().colors;
  return (
    <View className="min-h-10 flex-row items-center justify-between gap-4">
      <TText className="text-sm text-black/50 dark:text-white/50">{label}</TText>
      <TText
        className="flex-1 text-right text-sm"
        style={{ color: theme.text, fontFamily: Fonts.title }}>
        {value}
      </TText>
    </View>
  );
}

function GroupBalanceActionRow({
  friend,
  balance,
  actionLabel,
  onPress,
}: {
  friend: SplitFriend;
  balance: number;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const theme = useThemeTokens().colors;
  const settled = balance === 0;
  const color = balance > 0 ? theme.positive : balance < 0 ? theme.negative : theme.neutral;
  return (
    <View
      className="rounded-2xl border p-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="flex-row items-center gap-4">
        <AvatarCircle label={friend.name} size={46} />
        <View className="flex-1">
          <TText variant="cardTitle" style={{ color: theme.text }}>
            {friend.name}
          </TText>
          <TText className="mt-1 text-sm" style={{ color }}>
            {settled
              ? 'settled up'
              : balance > 0
                ? `owes you ${formatBalance(balance)}`
                : `you owe ${formatBalance(balance)}`}
          </TText>
        </View>
        <TText variant="cardTitle" style={{ color }}>
          {settled ? formatBalance(0) : formatBalance(balance)}
        </TText>
      </View>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          className="mt-4 min-h-11 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.accent }}>
          <TText className="text-sm text-white" style={{ fontFamily: Fonts.title }}>
            {actionLabel}
          </TText>
        </Pressable>
      ) : null}
    </View>
  );
}

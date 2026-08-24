import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DetailPill,
  FloatingExpenseButton,
} from '@/components/split/primitives/SplitPrimitives';
import {
  formatBalance,
  formatBillListDate,
  getExpenseIconConfig,
} from '@/components/split/split-utils';
import type { GroupActionMode, SplitGroupSummary } from '@/components/split/split-types';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SplitBill, SplitFriend } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export function GroupDetailModal({
  summary,
  friends,
  currentUserName,
  onClose,
  onAddExpense,
  onManageMembers,
  onInviteViaLink,
  onOpenExpense,
  onOpenAction,
  onOpenSettings,
}: {
  summary: SplitGroupSummary | null;
  friends: SplitFriend[];
  currentUserName: string;
  onClose: () => void;
  onAddExpense: (groupId: number) => void;
  onManageMembers: (summary: SplitGroupSummary) => void;
  onInviteViaLink: (summary: SplitGroupSummary) => void;
  onOpenExpense: (bill: SplitBill) => void;
  onOpenAction: (summary: SplitGroupSummary, mode: GroupActionMode) => void;
  onOpenSettings: (summary: SplitGroupSummary) => void;
}) {
  const theme = useThemeTokens().colors;
  const [groupSearchVisible, setGroupSearchVisible] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  if (!summary) return null;

  const memberNames = summary.memberIds
    .map((memberId) => friends.find((friend) => friend.id === memberId)?.name)
    .filter(Boolean);
  const canManageGroup = summary.group.viewer_can_manage === true;
  const canAddExpense = summary.group.viewer_can_add_expense !== false;
  const normalizedGroupSearch = groupSearchQuery.trim().toLowerCase();
  const filteredBills = normalizedGroupSearch
    ? summary.bills.filter((bill) => {
        const participantNames = bill.participants
          .map((participant) => friends.find((friend) => friend.id === participant.friend_id)?.name)
          .filter(Boolean)
          .join(' ');
        return [
          bill.title,
          bill.notes ?? '',
          bill.date,
          String(bill.total_amount),
          participantNames,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedGroupSearch);
      })
    : summary.bills;
  const overallCopy =
    summary.netBalance === 0
      ? summary.billCount > 0
        ? 'Everyone is settled up'
        : 'No expenses yet'
      : summary.netBalance > 0
        ? `You are owed ${formatBalance(summary.netBalance)} overall`
        : `You owe ${formatBalance(Math.abs(summary.netBalance))} overall`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="min-h-[270px] overflow-hidden" style={{ backgroundColor: theme.accent }}>
          <View
            style={{
              position: 'absolute',
              top: -34,
              left: 82,
              width: 260,
              height: 170,
              backgroundColor: `${theme.onAccent}14`,
              transform: [{ rotate: '28deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: -78,
              bottom: -4,
              width: 360,
              height: 172,
              backgroundColor: `${theme.onAccent}17`,
              transform: [{ rotate: '-18deg' }],
            }}
          />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close group"
                onPress={onClose}
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.onAccent }}>
                <MaterialCommunityIcons name="arrow-left" size={26} color={theme.shadow} />
              </Pressable>
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search group"
                  onPress={() => {
                    setGroupSearchVisible((current) => !current);
                    if (groupSearchVisible) setGroupSearchQuery('');
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.onAccent }}>
                  <MaterialCommunityIcons
                    name={groupSearchVisible ? 'close' : 'magnify'}
                    size={26}
                    color={theme.shadow}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Group settings"
                  onPress={() => onOpenSettings(summary)}
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.onAccent }}>
                  <MaterialCommunityIcons name="cog-outline" size={26} color={theme.shadow} />
                </Pressable>
              </View>
            </View>
            <View className="px-6 pb-8 pt-12">
              <TText variant="screenTitle" style={{ color: theme.onAccent }}>
                {summary.group.name}
              </TText>
              <View className="mt-5 flex-row gap-3">
                {/*
                 * Dates are a trip's shape, not every group's: a home or couple
                 * group runs indefinitely, so offering to bound it with a start
                 * and end date is an invitation to describe it wrongly.
                 */}
                {summary.kind === 'trip' ? (
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-12 flex-row items-center rounded-full border px-4"
                    style={{ borderColor: `${theme.onAccent}99`, backgroundColor: `${theme.shadow}14` }}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={19}
                      color={theme.onAccent}
                    />
                    <TText variant="button" className="ml-3" style={{ color: theme.onAccent }}>
                      Add trip dates
                    </TText>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={!canManageGroup}
                  onPress={() => onManageMembers(summary)}
                  className="min-h-12 flex-row items-center rounded-full px-4"
                  style={{ backgroundColor: `${theme.shadow}B8` }}>
                  <MaterialCommunityIcons name="account-group-outline" size={19} color={theme.onAccent} />
                  <TText variant="button" className="ml-3" style={{ color: theme.onAccent }}>
                    {memberNames.length + 1} people
                  </TText>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 132 }}>
          {groupSearchVisible ? (
            <View
              className="mb-5 min-h-13 flex-row items-center rounded-full border px-4"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}>
              <MaterialCommunityIcons name="magnify" size={22} color={theme.neutral} />
              <TextInput
                value={groupSearchQuery}
                onChangeText={setGroupSearchQuery}
                autoFocus
                autoCapitalize="none"
                placeholder="Search expenses"
                placeholderTextColor={`${theme.text}99`}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  minHeight: 48,
                  color: theme.text,
                  fontFamily: Fonts.body,
                  fontSize: 16,
                }}
              />
            </View>
          ) : null}

          <View>
            <TText variant="sectionTitle" style={{ color: theme.text }}>
              {overallCopy}
            </TText>
            {summary.detailLines.length > 0 ? (
              <View className="mt-3 border-l-4 py-1 pl-5" style={{ borderColor: theme.border }}>
                {summary.detailLines.map((line) => (
                  <TText key={line} className="py-1 text-lg leading-7" style={{ color: theme.neutral }}>
                    {line}
                  </TText>
                ))}
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-6"
            contentContainerStyle={{ gap: 12 }}>
            <DetailPill
              label="Settle up"
              icon="hand-coin-outline"
              onPress={() => onOpenAction(summary, 'settle')}
            />
            <DetailPill
              label="Totals"
              icon="calculator-variant-outline"
              onPress={() => onOpenAction(summary, 'totals')}
            />
            <DetailPill
              label="Balances"
              icon="scale-balance"
              onPress={() => onOpenAction(summary, 'balances')}
            />
            <DetailPill
              label="Export"
              icon="export-variant"
              onPress={() => onOpenAction(summary, 'export')}
            />
          </ScrollView>

          {/*
            * A group of one is the state every group starts in, and the only
            * way out of it used to be the settings cog — a place you go to
            * change something, not to finish making it. Both routes in belong
            * here, on the screen that is telling you nobody else is in.
            */}
          {memberNames.length === 0 && canManageGroup ? (
            <View
              className="mt-6 rounded-3xl border p-5"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <TText
                className="text-center text-lg"
                style={{ color: theme.text, fontFamily: Fonts.title }}>
                You&apos;re the only one here
              </TText>
              <TText className="mt-2 text-center text-base leading-6 text-black/55">
                Add the people you split with, or send them a link to join.
              </TText>
              <Pressable
                accessibilityRole="button"
                onPress={() => onManageMembers(summary)}
                className="mt-5 min-h-14 flex-row items-center justify-center gap-3 rounded-full"
                style={{ backgroundColor: theme.accent }}>
                <MaterialCommunityIcons name="account-plus-outline" size={22} color={theme.onAccent} />
                <TText variant="button" style={{ color: theme.onAccent }}>
                  Add group members
                </TText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onInviteViaLink(summary)}
                className="mt-3 min-h-14 flex-row items-center justify-center gap-3 rounded-full border"
                style={{ borderColor: theme.border }}>
                <MaterialCommunityIcons name="link-variant" size={22} color={theme.accent} />
                <TText variant="button" style={{ color: theme.accent }}>
                  Share group link
                </TText>
              </Pressable>
            </View>
          ) : null}

          <View className="mt-6">
            {filteredBills.length > 0 ? (
              filteredBills.map((bill) => (
                <GroupExpenseRow
                  key={bill.id}
                  bill={bill}
                  currentUserName={currentUserName}
                  friends={friends}
                  onPress={() => onOpenExpense(bill)}
                />
              ))
            ) : normalizedGroupSearch ? (
              <View className="items-center px-6 py-20">
                <MaterialCommunityIcons name="magnify" size={34} color={theme.neutral} />
                <TText
                  className="mt-4 text-center text-lg"
                  style={{ color: theme.text, fontFamily: Fonts.title }}>
                  No matching expenses
                </TText>
                <TText className="mt-2 text-center text-sm leading-5 text-black/55">
                  Try searching by title, amount, date, notes, or friend name.
                </TText>
              </View>
            ) : (
              <View className="items-center px-6 py-24">
                <View
                  className="h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: theme.secondary }}>
                  <MaterialCommunityIcons
                    name="receipt-text-plus-outline"
                    size={30}
                    color={theme.accent}
                  />
                </View>
                <TText
                  className="mt-5 text-center text-lg"
                  style={{ color: theme.text, fontFamily: Fonts.title }}>
                  Add your first expense
                </TText>
                <TText className="mt-2 text-center text-sm leading-5 text-black/55">
                  Expenses for {summary.group.name} will appear here once you add them.
                </TText>
              </View>
            )}
          </View>
        </ScrollView>

        {canAddExpense ? (
          <FloatingExpenseButton onPress={() => onAddExpense(summary.group.id)} />
        ) : null}
      </View>
    </Modal>
  );
}

function GroupExpenseRow({
  bill,
  currentUserName,
  friends,
  onPress,
}: {
  bill: SplitBill;
  currentUserName: string;
  friends: SplitFriend[];
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  const date = formatBillListDate(bill.date);
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const payerParticipant = bill.participants.find(
    (participant) => participant.direction === 'user_owes_friend'
  );
  const payerName = payerParticipant
    ? (friendById.get(payerParticipant.friend_id)?.name ?? 'Friend')
    : currentUserName;
  const paidByYou = !payerParticipant || payerName === currentUserName;
  const iconConfig = getExpenseIconConfig(bill.title);
  const youLent = bill.participants
    .filter((participant) => participant.direction === 'friend_owes_user')
    .reduce((sum, participant) => sum + participant.share_amount, 0);
  const youBorrowed = bill.participants
    .filter((participant) => participant.direction === 'user_owes_friend')
    .reduce((sum, participant) => sum + participant.share_amount, 0);
  const net = youLent - youBorrowed;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[88px] flex-row items-start gap-4 py-3">
      <View className="w-9 items-center pt-1">
        <TText className="text-base text-black/55">{date.month}</TText>
        <TText variant="cardTitle" className="text-black/55">
          {date.day}
        </TText>
      </View>
      <View
        className="h-16 w-16 items-center justify-center rounded"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name={iconConfig.icon} size={34} color={theme.text} />
      </View>
      <View className="flex-1 pt-1">
        <TText variant="cardTitle" style={{ color: theme.text }}>
          {bill.title}
        </TText>
        <TText className="mt-1 text-base text-black/50">
          {paidByYou ? 'You' : payerName} paid {formatBalance(bill.total_amount)}
        </TText>
      </View>
      {net !== 0 ? (
        <View className="items-end pt-1">
          <TText
            className="text-xs"
            style={{ color: net > 0 ? theme.positive : theme.negative, fontFamily: Fonts.title }}>
            {net > 0 ? 'you lent' : 'you borrowed'}
          </TText>
          <TText
            className="mt-1 text-base"
            style={{ color: net > 0 ? theme.positive : theme.negative, fontFamily: Fonts.title }}>
            {formatBalance(net)}
          </TText>
        </View>
      ) : null}
    </Pressable>
  );
}

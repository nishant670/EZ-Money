import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { formatBalance } from '@/components/split/split-utils';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SplitBill, SplitFriend } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export function BillDetailModal({
  bill,
  friends,
  currentUserName,
  onClose,
  onEdit,
  onDelete,
}: {
  bill: SplitBill | null;
  friends: SplitFriend[];
  currentUserName: string;
  onClose: () => void;
  onEdit: (bill: SplitBill) => void;
  onDelete: (bill: SplitBill) => void;
}) {
  const theme = useThemeTokens().colors;
  const presentedBillRef = useRef<SplitBill | null>(bill);
  if (bill) presentedBillRef.current = bill;
  const presentedBill = presentedBillRef.current;

  if (!presentedBill) return null;

  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const payerParticipant = presentedBill.participants.find(
    (participant) => participant.direction === 'user_owes_friend'
  );
  const payerName = payerParticipant
    ? (friendById.get(payerParticipant.friend_id)?.name ?? 'Friend')
    : currentUserName;
  const paidLine = `${payerName === currentUserName ? 'You' : payerName} paid ${formatBalance(
    presentedBill.total_amount
  )}`;
  const canEdit = presentedBill.viewer_can_edit === true;
  const canDelete = presentedBill.viewer_can_delete === true;

  return (
    <AnimatedBottomSheet
      visible={Boolean(bill)}
      onClose={onClose}
      sheetStyle={{ maxHeight: '92%' }}>
      <View
        className="overflow-hidden rounded-t-[28px] border"
        style={{ backgroundColor: theme.card, borderColor: theme.border, flexShrink: 1 }}>
        <View
          className="min-h-16 flex-row items-center border-b px-5 pt-2"
          style={{ borderColor: theme.border }}>
          <View className="flex-1">
            <TText variant="sectionTitle" style={{ color: theme.text }}>
              Expense details
            </TText>
          </View>
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete expense"
              onPress={() => onDelete(presentedBill)}
              className="h-11 w-11 items-center justify-center rounded-full">
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.negative} />
            </Pressable>
          ) : null}
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit expense"
              onPress={() => onEdit(presentedBill)}
              className="h-11 w-11 items-center justify-center rounded-full">
              <MaterialCommunityIcons name="pencil-outline" size={24} color={theme.text} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close expense details"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 44, paddingTop: 24 }}>
          <View className="flex-row items-start gap-5">
            <View
              className="h-20 w-20 items-center justify-center rounded-xl border"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <MaterialCommunityIcons name="receipt-text-outline" size={44} color={theme.text} />
            </View>
            <View className="flex-1">
              <TText variant="screenTitle" style={{ color: theme.text }}>
                {presentedBill.title}
              </TText>
              <TText variant="amount" className="mt-2" style={{ color: theme.text }}>
                {formatBalance(presentedBill.total_amount)}
              </TText>
              <TText className="mt-4 text-base leading-6 text-black/55 dark:text-white/55">
                {presentedBill.date}
                {presentedBill.created_at ? `\nAdded on ${presentedBill.created_at.slice(0, 10)}` : ''}
              </TText>
            </View>
          </View>

          <View className="mt-10">
            <TText variant="screenTitle" style={{ color: theme.text }}>
              {paidLine}
            </TText>
            <View className="mt-5 gap-4">
              {presentedBill.participants.map((participant) => {
                const friendName = friendById.get(participant.friend_id)?.name ?? 'Friend';
                const isUserOwes = participant.direction === 'user_owes_friend';
                const label = isUserOwes
                  ? `You owe ${friendName} ${formatBalance(participant.share_amount)}`
                  : `${friendName} owes ${formatBalance(participant.share_amount)}`;
                return (
                  <View
                    key={`${participant.friend_id}-${participant.direction}`}
                    className="flex-row items-center">
                    <View
                      className="mr-4 h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.secondary }}>
                      <TText style={{ color: theme.accent, fontFamily: Fonts.title }}>
                        {friendName.charAt(0).toUpperCase()}
                      </TText>
                    </View>
                    <TText className="flex-1 text-lg text-black/60 dark:text-white/60">
                      {label}
                    </TText>
                  </View>
                );
              })}
            </View>
          </View>

          {presentedBill.notes ? (
            <View className="mt-10 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
              <TText
                className="text-xs text-black/45 dark:text-white/45"
                style={{ fontFamily: Fonts.title }}>
                Notes
              </TText>
              <TText className="mt-2 text-base leading-6" style={{ color: theme.text }}>
                {presentedBill.notes}
              </TText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AnimatedBottomSheet>
  );
}

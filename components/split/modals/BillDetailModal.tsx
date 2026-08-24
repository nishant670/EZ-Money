import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatBalance } from '@/components/split/split-utils';
import { ThemedText } from '@/components/themed-text';
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
  if (!bill) return null;

  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const payerParticipant = bill.participants.find(
    (participant) => participant.direction === 'user_owes_friend'
  );
  const payerName = payerParticipant
    ? (friendById.get(payerParticipant.friend_id)?.name ?? 'Friend')
    : currentUserName;
  const paidLine = `${payerName === currentUserName ? 'You' : payerName} paid ${formatBalance(
    bill.total_amount
  )}`;
  const canEdit = bill.viewer_can_edit === true;
  const canDelete = bill.viewer_can_delete === true;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        <View
          className="min-h-16 flex-row items-center border-b px-5"
          style={{ backgroundColor: theme.secondary, borderColor: theme.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close expense details"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={28} color={theme.text} />
          </Pressable>
          <View className="flex-1" />
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete expense"
              onPress={() => onDelete(bill)}
              className="h-11 w-11 items-center justify-center">
              <MaterialCommunityIcons name="trash-can-outline" size={27} color={theme.negative} />
            </Pressable>
          ) : null}
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit expense"
              onPress={() => onEdit(bill)}
              className="h-11 w-11 items-center justify-center">
              <MaterialCommunityIcons name="pencil-outline" size={27} color={theme.text} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 28 }}>
          <View className="flex-row items-start gap-5">
            <View
              className="h-20 w-20 items-center justify-center rounded-xl border"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <MaterialCommunityIcons name="receipt-text-outline" size={44} color={theme.text} />
            </View>
            <View className="flex-1">
              <TText variant="screenTitle" style={{ color: theme.text }}>
                {bill.title}
              </TText>
              <TText variant="amount" className="mt-2" style={{ color: theme.text }}>
                {formatBalance(bill.total_amount)}
              </TText>
              <TText className="mt-4 text-base leading-6 text-black/55 dark:text-white/55">
                {bill.date}
                {bill.created_at ? `\nAdded on ${bill.created_at.slice(0, 10)}` : ''}
              </TText>
            </View>
          </View>

          <View className="mt-10">
            <TText variant="screenTitle" style={{ color: theme.text }}>
              {paidLine}
            </TText>
            <View className="mt-5 gap-4">
              {bill.participants.map((participant) => {
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

          {bill.notes ? (
            <View className="mt-10 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
              <TText
                className="text-xs text-black/45 dark:text-white/45"
                style={{ fontFamily: Fonts.title }}>
                Notes
              </TText>
              <TText className="mt-2 text-base leading-6" style={{ color: theme.text }}>
                {bill.notes}
              </TText>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

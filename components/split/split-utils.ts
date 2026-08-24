import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { DeviceContactOption, SplitGroupSummary } from '@/components/split/split-types';
import { formatMoney } from '@/lib/money';
import type { SplitFriend } from '@/lib/splits';
import type { GroupKind } from '@/lib/split-preferences';

export const groupKindOptions: {
  kind: GroupKind;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { kind: 'trip', label: 'Trip', icon: 'airplane' },
  { kind: 'home', label: 'Home', icon: 'home-outline' },
  { kind: 'couple', label: 'Couple', icon: 'heart-outline' },
  { kind: 'other', label: 'Other', icon: 'format-list-bulleted' },
];

export const getGroupKindConfig = (kind: GroupKind) =>
  groupKindOptions.find((option) => option.kind === kind) ?? groupKindOptions[3];

// Split balances are always drawn with their own directional wording
// ("owes you" / "you owe"), so the sign would be redundant noise.
export const formatBalance = (value: number) => formatMoney(value, { sign: 'never' });

export const formatMonthYear = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year || 2000, (month || 1) - 1, day || 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const normalizePhone = (value?: string) => value?.replace(/\D/g, '') ?? '';

const normalizeEmail = (value?: string) => value?.trim().toLowerCase() ?? '';

export const contactMatchesFriend = (contact: DeviceContactOption, friend: SplitFriend) => {
  const contactPhone = normalizePhone(contact.phone);
  const friendPhone = normalizePhone(friend.phone);
  const contactEmail = normalizeEmail(contact.email);
  const friendEmail = normalizeEmail(friend.email);
  return Boolean(
    (contactEmail && friendEmail && contactEmail === friendEmail) ||
      (contactPhone && friendPhone && contactPhone === friendPhone)
  );
};

export const formatBillListDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year || 2000, (month || 1) - 1, day || 1);
  return {
    month: date.toLocaleString('en-US', { month: 'short' }),
    day: String(day || date.getDate()).padStart(2, '0'),
  };
};

export const getExpenseIconConfig = (
  title: string
): {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
} => {
  const normalized = title.toLowerCase();
  if (/(dinner|lunch|snack|food|restaurant|meal)/.test(normalized)) {
    return { icon: 'silverware-fork-knife' };
  }
  if (/(airbnb|hotel|stay|room|rent)/.test(normalized)) {
    return { icon: 'office-building-outline' };
  }
  if (/(travel|cab|taxi|train|flight|trip)/.test(normalized)) {
    return { icon: 'car-outline' };
  }
  return { icon: 'receipt-text-outline' };
};

export const getGroupBalanceRows = (summary: SplitGroupSummary, friends: SplitFriend[]) => {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  return summary.memberIds
    .map((friendId) => {
      const balance = summary.bills.reduce((sum, bill) => {
        const participant = bill.participants?.find((item) => item.friend_id === friendId);
        if (!participant) return sum;
        return (
          sum +
          (participant.direction === 'friend_owes_user'
            ? participant.share_amount
            : -participant.share_amount)
        );
      }, 0);
      const friend = friendById.get(friendId);
      if (!friend) return null;
      return { friend, balance };
    })
    .filter((row): row is { friend: SplitFriend; balance: number } => Boolean(row));
};

export const getGroupTotals = (
  summary: SplitGroupSummary,
  friends: SplitFriend[],
  currentUserName: string
) => {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  return summary.bills.reduce(
    (totals, bill) => {
      totals.total += bill.total_amount;
      const payerParticipant = bill.participants.find(
        (participant) => participant.direction === 'user_owes_friend'
      );
      if (payerParticipant) {
        totals.friendPaid += bill.total_amount;
        const payerName = friendById.get(payerParticipant.friend_id)?.name ?? 'Friend';
        totals.payers.set(payerName, (totals.payers.get(payerName) ?? 0) + bill.total_amount);
      } else {
        totals.youPaid += bill.total_amount;
        totals.payers.set(currentUserName, (totals.payers.get(currentUserName) ?? 0) + bill.total_amount);
      }
      bill.participants.forEach((participant) => {
        if (participant.direction === 'friend_owes_user') {
          totals.youLent += participant.share_amount;
        } else {
          totals.youBorrowed += participant.share_amount;
        }
      });
      return totals;
    },
    {
      total: 0,
      youPaid: 0,
      friendPaid: 0,
      youLent: 0,
      youBorrowed: 0,
      payers: new Map<string, number>(),
    }
  );
};

export const todayApiDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseApiDate = (value: string) => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());

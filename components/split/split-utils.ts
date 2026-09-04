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

/**
 * How many settled groups a balance filter is actually holding back.
 *
 * Derived from the rendered list rather than counted independently, because
 * counting it independently is what put "Hiding groups that are settled up"
 * directly above the settled group it claimed to be hiding. Two cases broke
 * the old count: under the `all` filter nothing is held back, and a
 * freshly-made group is settled by definition but is deliberately kept on
 * screen so it does not vanish the moment it is created.
 *
 * Taking `visible` as the source of truth means the hint cannot disagree with
 * the list again, whatever exceptions that list grows later. `matchesSearch`
 * is separate because a group hidden by a query is not hidden for being
 * settled, and switching the balance filter would not bring it back.
 */
export function countHiddenSettledGroups<T extends { group: { id: number }; netBalance: number }>(
  summaries: readonly T[],
  visible: readonly T[],
  matchesSearch: (summary: T) => boolean
): number {
  const visibleIds = new Set(visible.map((summary) => summary.group.id));
  return summaries.filter(
    (summary) =>
      !visibleIds.has(summary.group.id) && summary.netBalance === 0 && matchesSearch(summary)
  ).length;
}

/**
 * Whether a group answers the search box — its name, its detail lines, or any
 * member's name.
 *
 * Shared so the list and the settled-up hint cannot drift apart on what
 * "matches" means; they disagreed once already, and a search predicate copied
 * into two places is how that happens a second time.
 */
export function groupMatchesSearch(
  summary: SplitGroupSummary,
  normalizedSearch: string,
  friendById: Map<number, SplitFriend>
): boolean {
  if (!normalizedSearch) return true;
  return [
    summary.group.name,
    ...summary.detailLines,
    ...summary.memberIds.map((memberId) => friendById.get(memberId)?.name ?? ''),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch);
}

/**
 * The group members the expense composer can actually put a row on screen for.
 *
 * A group keeps its membership rows when a friend is archived, so `members` can
 * name somebody the friends list will never return. That split the composer in
 * two: these keys decide who *carries* a share, and the people list — which
 * resolves every member through the friends it has — decides who gets a *row*.
 * When the two disagree, the difference is a participant that counts toward the
 * total with nothing on screen to edit.
 *
 * The symptom was a percentage split reporting **150.00%** over two visible
 * rows reading 60 and 40: a third participant, invisible, still holding the 50
 * it had been seeded with when the split was two people. There was no way to
 * fix it from the UI, because the row it belonged to had been filtered out of
 * the UI.
 *
 * `resolvable` is the same lookup the people list uses. Passing it in rather
 * than a friends array keeps the two reading from one map instead of two copies
 * of the same filter.
 */
export function composerMemberKeys(
  members: { friend_id: number }[] | undefined,
  resolvable: { has: (friendId: number) => boolean },
  fallback: SplitFriend[]
): string[] {
  const keys = members
    ? members.filter((member) => resolvable.has(member.friend_id)).map((member) => String(member.friend_id))
    : fallback.map((friend) => String(friend.id));
  return [...new Set(keys)];
}

/**
 * What a zero balance means, and which of the two things it is.
 *
 * "Settled up" is a claim about what happened: money was owed and it came back.
 * A group made ten seconds ago has a zero balance for the opposite reason —
 * nothing has happened in it at all — and the screen said "settled up" there
 * too, congratulating the user on an event that never took place and hiding the
 * one thing the row should have been prompting: add the first expense.
 *
 * `hasActivity` is the whole distinction. It is false only when there is
 * nothing on that ledger to settle, so a group that genuinely balanced back out
 * to zero keeps "settled up" and keeps its meaning.
 *
 * Returns the phrase for a zero balance only; a non-zero one is drawn with an
 * animated amount beside it and cannot be a plain string.
 */
export const zeroBalanceLabel = ({
  hasActivity,
  overall = false,
}: {
  hasActivity: boolean;
  /** The screen-wide figure rather than one row's. */
  overall?: boolean;
}) => {
  if (!hasActivity) return overall ? 'Nothing to settle yet' : 'No expenses yet';
  return overall ? 'Overall, settled up' : 'settled up';
};

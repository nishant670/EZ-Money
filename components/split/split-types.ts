import type { GroupKind } from '@/lib/split-preferences';
import type { SplitBalance, SplitBill, SplitFriend, SplitGroup } from '@/lib/splits';

export type GroupActionMode = 'settle' | 'totals' | 'balances' | 'export';

/**
 * One person in a group, ready to draw — resolved against whoever is looking.
 *
 * `friendId` is the *viewer's own* friend row for that person, which is the
 * only id their settle-up and balance screens can act on. It is 0 for the
 * viewer themselves, and 0 for anybody they have no row for yet; `name` is
 * filled either way so nobody is missing from a roster merely because they
 * cannot be settled with.
 */
export type SplitGroupRosterPerson = {
  /** The person in the group owner's namespace: 'owner', or a friend id. */
  slot: string;
  friendId: number;
  name: string;
  subtitle: string;
  isViewer: boolean;
};

export type SplitGroupSummary = {
  group: SplitGroup;
  billCount: number;
  bills: SplitBill[];
  detailLines: string[];
  latestBill?: SplitBill;
  kind: GroupKind;
  /**
   * The roster in the *owner's* namespace. Only for talking to the group
   * editor, which writes that namespace back. Anything drawn on screen wants
   * `roster` instead — these ids mean nothing to a member.
   */
  memberIds: number[];
  /** Everyone in the group, resolved for whoever is looking. */
  roster: SplitGroupRosterPerson[];
  netBalance: number;
};

export type FriendDetailSummary = {
  friend: SplitFriend;
  balance: SplitBalance | null;
  groups: SplitGroupSummary[];
  bills: SplitBill[];
  netBalance: number;
};

export type DeviceContactOption = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
};

import type { GroupKind } from '@/lib/split-preferences';
import type { SplitBalance, SplitBill, SplitFriend, SplitGroup } from '@/lib/splits';

export type GroupActionMode = 'settle' | 'totals' | 'balances' | 'export';

export type SplitGroupSummary = {
  group: SplitGroup;
  billCount: number;
  bills: SplitBill[];
  detailLines: string[];
  latestBill?: SplitBill;
  kind: GroupKind;
  memberIds: number[];
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

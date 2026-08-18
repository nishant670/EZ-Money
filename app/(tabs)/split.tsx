import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter, useScrollToTop } from 'expo-router';
import { cssInterop } from 'nativewind';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UpgradeSheet } from '@/components/billing/UpgradeSheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SkeletonFrame, SkeletonRows } from '@/components/ui/Skeleton';
import { ThemedDeleteDialog } from '@/components/ui/ThemedConfirmDialog';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useEntitlementGate } from '@/hooks/use-entitlement-gate';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fetchAccounts, getPreferredAccountForPaymentMode } from '@/lib/accounts';
import { userDisplayName } from '@/lib/display-name';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import { createEntry } from '@/lib/entries';
import { formatMoney, toAmountString } from '@/lib/money';
import {
  buildSeedWeights,
  computeSplitShares,
  CURRENT_USER_KEY,
  defaultSplitToComposerKeys,
  defaultSplitToSelection,
  describeGroupDefaultSplit,
  describeMemberInvites,
  describeSplitTab,
  friendSplitKey,
  groupSplitSlots,
  isDefaultSplitTab,
  selectionToDefaultSplit,
  splitParticipantKeys,
  sumSplitWeights,
  viewerSplitSlot,
  type AdjustSplitTab,
  type GroupKind,
  type SplitSelection,
  type SplitSlotPerson,
  type SplitWeights,
} from '@/lib/split-preferences';
import {
  SPLIT_GROUP_OWNER_SLOT,
  archiveSplitGroup,
  archiveSplitFriend,
  createSplitBill,
  createSplitFriend,
  createSplitGroup,
  createSplitGroupDirectInvite,
  createSplitGroupInviteLink,
  createSplitSettlement,
  deleteSplitBill,
  fetchSplitActivity,
  fetchSplitBalances,
  fetchSplitBills,
  fetchSplitFriends,
  fetchSplitGroups,
  fetchSplitGroupDirectInvites,
  leaveSplitGroup,
  revokeSplitGroupDirectInvite,
  splitScreenState,
  updateSplitBill,
  updateSplitFriend,
  setSplitGroupDefaultSplit,
  updateSplitGroup,
  type SettlementDirection,
  type SplitActivityItem,
  type SplitBalance,
  type SplitBill,
  type SplitBillPayload,
  type SplitDirection,
  type SplitFriend,
  type SplitGroup,
  type SplitGroupDirectInvite,
  type SplitGroupMemberInvite,
} from '@/lib/splits';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type ModalKind = 'friend' | 'group' | 'bill' | 'settlement' | 'group_invite' | null;
type ActiveSection = 'groups' | 'friends' | 'activity';
type BalanceFilter = 'all' | 'open' | 'owed_to_me' | 'i_owe' | 'settled';
type ExpenseFlowScreen = 'expense' | 'split_choice' | 'adjust_split';
type GroupActionMode = 'settle' | 'totals' | 'balances' | 'export';
type SplitGroupSummary = {
  group: SplitGroup;
  billCount: number;
  bills: SplitBill[];
  detailLines: string[];
  latestBill?: SplitBill;
  kind: GroupKind;
  memberIds: number[];
  netBalance: number;
};
type FriendDetailSummary = {
  friend: SplitFriend;
  balance: SplitBalance | null;
  groups: SplitGroupSummary[];
  bills: SplitBill[];
  netBalance: number;
};
type ParticipantDraft = {
  friend_id: number;
  share_amount: number;
  direction: SplitDirection;
};
type DeviceContactOption = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
};

const groupKindOptions: {
  kind: GroupKind;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  variant: number;
}[] = [
  { kind: 'trip', label: 'Trip', icon: 'airplane', variant: 2 },
  { kind: 'home', label: 'Home', icon: 'home-outline', variant: 4 },
  { kind: 'couple', label: 'Couple', icon: 'heart-outline', variant: 3 },
  { kind: 'other', label: 'Other', icon: 'format-list-bulleted', variant: 0 },
];

// Split balances are always drawn with their own directional wording
// ("owes you" / "you owe"), so the sign would be redundant noise.
const formatBalance = (value: number) => formatMoney(value, { sign: 'never' });

const formatBillListDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year || 2000, (month || 1) - 1, day || 1);
  return {
    month: date.toLocaleString('en-US', { month: 'short' }),
    day: String(day || date.getDate()).padStart(2, '0'),
  };
};

const formatMonthYear = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year || 2000, (month || 1) - 1, day || 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const todayApiDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseApiDate = (value: string) => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseAmount = (value: string) => Number(value.replace(/,/g, '').trim());

const normalizePhone = (value?: string) => value?.replace(/\D/g, '') ?? '';

const normalizeEmail = (value?: string) => value?.trim().toLowerCase() ?? '';

const contactMatchesFriend = (contact: DeviceContactOption, friend: SplitFriend) => {
  const contactPhone = normalizePhone(contact.phone);
  const friendPhone = normalizePhone(friend.phone);
  const contactEmail = normalizeEmail(contact.email);
  const friendEmail = normalizeEmail(friend.email);
  return Boolean(
    (contactEmail && friendEmail && contactEmail === friendEmail) ||
      (contactPhone && friendPhone && contactPhone === friendPhone)
  );
};

const toDeviceContactOption = (contact: Contacts.ExistingContact): DeviceContactOption | null => {
  const fallbackName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  const name = (contact.name || fallbackName || contact.phoneNumbers?.[0]?.number || '').trim();
  if (!name) return null;
  return {
    id: contact.id,
    name,
    phone: contact.phoneNumbers?.find((phone) => phone.number)?.number,
    email: contact.emails?.find((email) => email.email)?.email,
    imageUri: contact.image?.uri,
  };
};

const getBalanceTone = (value: number) => {
  if (value > 0) return { label: `you are owed ${formatBalance(value)}`, color: '#12966F' };
  if (value < 0) return { label: `you owe ${formatBalance(value)}`, color: '#DC2626' };
  return { label: 'settled up', color: '#6B7280' };
};

type BuiltParticipants =
  | { ok: true; participants: ParticipantDraft[] }
  | { ok: false; error: string };

/**
 * A bill only records debts against the signed-in user, so a split they paid
 * becomes one row per friend, and a split a friend paid collapses to the single
 * row for what the user owes them. Keys here are always the composer's own:
 * `me` for the author, friend ids for everybody else.
 */
const buildParticipantsFromSelection = (
  selection: SplitSelection,
  amount: number
): BuiltParticipants => {
  const keys = splitParticipantKeys(selection);
  const computed = computeSplitShares({
    amount,
    tab: selection.tab,
    keys,
    weights: selection.weights,
  });
  if (!computed.ok) return computed;

  if (selection.payerKey === CURRENT_USER_KEY) {
    const participants = keys
      .filter((key) => key !== CURRENT_USER_KEY)
      .map((key) => ({
        friend_id: Number(key),
        share_amount: computed.shares[key] ?? 0,
        direction: 'friend_owes_user' as SplitDirection,
      }))
      .filter((participant) => participant.friend_id > 0 && participant.share_amount > 0);
    if (participants.length === 0) {
      return { ok: false, error: 'Choose at least one friend for this split.' };
    }
    return { ok: true, participants };
  }

  const payerId = Number(selection.payerKey);
  if (!payerId) return { ok: false, error: 'Choose who paid for this expense.' };
  const userShare = computed.shares[CURRENT_USER_KEY] ?? 0;
  if (userShare <= 0) {
    return { ok: false, error: 'Add yourself to the split to record what you owe.' };
  }
  return {
    ok: true,
    participants: [{ friend_id: payerId, share_amount: userShare, direction: 'user_owes_friend' }],
  };
};

const getGroupKindConfig = (kind: GroupKind) =>
  groupKindOptions.find((option) => option.kind === kind) ?? groupKindOptions[3];

const getActivityIcon = (
  type: SplitActivityItem['type']
): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (type) {
    case 'group_created':
      return 'account-group-outline';
    case 'friend_created':
      return 'account-plus-outline';
    case 'settlement':
      return 'hand-coin-outline';
    default:
      return 'receipt-text-outline';
  }
};

const getGroupBalanceRows = (summary: SplitGroupSummary, friends: SplitFriend[]) => {
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

const getGroupTotals = (
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

const csvCell = (value: string | number | null | undefined) => {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const csvRow = (values: (string | number | null | undefined)[]) =>
  values.map(csvCell).join(',');

const getSafeExportFileName = (name: string) =>
  name
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'split-group';

const buildGroupExportCsv = (
  summary: SplitGroupSummary,
  friends: SplitFriend[],
  currentUserName: string
) => {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const balances = getGroupBalanceRows(summary, friends);
  const rows: string[] = [
    csvRow(['Finnri Split Report']),
    csvRow(['Group', summary.group.name]),
    csvRow(['Exported on', todayApiDate()]),
    csvRow(['Currency', 'INR']),
    csvRow([]),
    csvRow(['Who owes whom']),
    csvRow(['Who owes', 'Who gets paid', 'Amount', 'Status']),
  ];

  const openBalances = balances.filter(({ balance }) => balance !== 0);
  if (openBalances.length === 0) {
    rows.push(csvRow(['Everyone', 'Everyone', 0, 'Settled up']));
  } else {
    openBalances.forEach(({ friend, balance }) => {
      rows.push(
        balance > 0
          ? csvRow([friend.name, currentUserName, toAmountString(Math.abs(balance)), 'Open'])
          : csvRow([currentUserName, friend.name, toAmountString(Math.abs(balance)), 'Open'])
      );
    });
  }

  rows.push(csvRow([]));
  rows.push(csvRow(['Expenses']));
  rows.push([
    'Date',
    'Expense',
    'Total amount',
    'Paid by',
    'Split with',
    'Share details',
    'Notes',
  ].map(csvCell).join(','));

  summary.bills.forEach((bill) => {
    const payerParticipant = bill.participants.find(
      (participant) => participant.direction === 'user_owes_friend'
    );
    const payer = payerParticipant
      ? (friendById.get(payerParticipant.friend_id)?.name ?? 'Friend')
      : currentUserName;
    const splitWith = bill.participants
      .map((participant) => friendById.get(participant.friend_id)?.name ?? 'Friend')
      .join(', ');
    const shareDetails = bill.participants
      .map((participant) => {
        const friendName = friendById.get(participant.friend_id)?.name ?? 'Friend';
        return participant.direction === 'friend_owes_user'
          ? `${friendName} owes ${currentUserName} ${formatBalance(participant.share_amount)}`
          : `${currentUserName} owes ${friendName} ${formatBalance(participant.share_amount)}`;
      })
      .join('; ');
    rows.push(
      csvRow([
        bill.date,
        bill.title,
        toAmountString(bill.total_amount),
        payer,
        splitWith,
        shareDetails,
        bill.notes ?? '',
      ])
    );
  });

  return rows.join('\n');
};

/**
 * Neither of the two connection messages ends in "and try again" any more.
 * Both of the places they land now carry a Try again control of their own, and
 * a sentence that asks for a tap next to a button that performs it reads as two
 * different instructions.
 */
const formatFriendlySplitError = (error: unknown, fallback: string) => {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('network request failed') ||
    normalized.includes('fetch failed') ||
    normalized.includes('failed to connect') ||
    normalized.includes('java.net') ||
    normalized.includes('connectexception') ||
    normalized.includes('timed out') ||
    normalized.includes('networkerror')
  ) {
    return 'We could not reach Finnri. Check your internet connection.';
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('could not resolve') ||
    normalized.includes('connection refused')
  ) {
    return 'Finnri is not responding right now.';
  }

  if (!rawMessage.trim()) return fallback;

  const withoutBullets = rawMessage
    .split('\n')
    .map((line) => line.trim().replace(/^•\s*/, ''))
    .filter(Boolean);
  const userSafeLines = withoutBullets.filter(
    (line) =>
      !/java\.net|connectexception|\/\d{1,3}(?:\.\d{1,3}){3}:\d+|stack|trace/i.test(line)
  );
  return userSafeLines.length > 0 ? userSafeLines.join('\n') : fallback;
};

type SplitScreenProps = {
  embedded?: boolean;
};

export default function SplitScreen({ embedded = false }: SplitScreenProps) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { token, user } = useAuthStore();
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const borderColor = theme.border;
  const currentUserName = userDisplayName(user?.username, 'You');
  const currentUserContact = user?.email?.trim() || user?.phone?.trim() || '';

  const [friends, setFriends] = useState<SplitFriend[]>([]);
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [balances, setBalances] = useState<SplitBalance[]>([]);
  const [bills, setBills] = useState<SplitBill[]>([]);
  const [activity, setActivity] = useState<SplitActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /**
   * Two different failures, deliberately not sharing a slot.
   *
   * `error` is something the user just did that did not work — a name left
   * blank, a settlement that would not save. It belongs in a banner over a
   * screen that still has its content.
   *
   * `loadError` is the ledger itself never arriving. It cannot be a banner,
   * because everything under a banner would then be drawn from state that was
   * never filled: "Overall, settled up" over "Create your first group" is not
   * an empty account, it is an unanswered request wearing one's clothes — and
   * it invites a user with eight groups to make a ninth.
   */
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('groups');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('open');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedGroupDetailId, setSelectedGroupDetailId] = useState<number | null>(null);
  const [groupSettingsId, setGroupSettingsId] = useState<number | null>(null);
  const [groupAction, setGroupAction] = useState<{
    groupId: number;
    mode: GroupActionMode;
  } | null>(null);
  const [pendingGroupDelete, setPendingGroupDelete] = useState<SplitGroupSummary | null>(null);
  const [pendingGroupLeave, setPendingGroupLeave] = useState<SplitGroupSummary | null>(null);
  const [selectedFriendDetailId, setSelectedFriendDetailId] = useState<number | null>(null);
  const [selectedFriendActions, setSelectedFriendActions] = useState<SplitFriend | null>(null);
  const [pendingFriendDelete, setPendingFriendDelete] = useState<SplitFriend | null>(null);
  const [editingFriendId, setEditingFriendId] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [memberPickerGroupId, setMemberPickerGroupId] = useState<number | null>(null);
  const [memberPickerFriendIds, setMemberPickerFriendIds] = useState<number[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [contactsPermissionStatus, setContactsPermissionStatus] =
    useState<Contacts.PermissionStatus | null>(null);
  const [contactsAccessPrivileges, setContactsAccessPrivileges] = useState<
    Contacts.ContactsPermissionResponse['accessPrivileges'] | null
  >(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContactOption[]>([]);
  const [pendingFriendGroupId, setPendingFriendGroupId] = useState<number | null>(null);
  /**
   * Balance alerts are still only a form field — nothing acts on them yet — so
   * they stay in memory rather than pretending to be saved.
   */
  const [groupBalanceAlertById, setGroupBalanceAlertById] = useState<
    Record<number, { enabled: boolean; amount: string }>
  >({});
  const [defaultSplitGroupId, setDefaultSplitGroupId] = useState<number | null>(null);
  const [defaultSplitScreen, setDefaultSplitScreen] = useState<'choice' | 'adjust'>('choice');
  const [defaultSplitDraft, setDefaultSplitDraft] = useState<SplitSelection | null>(null);
  const [defaultSplitError, setDefaultSplitError] = useState<string | null>(null);

  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupKind, setGroupKind] = useState<GroupKind>('trip');
  const [groupBalanceAlertEnabled, setGroupBalanceAlertEnabled] = useState(false);
  const [groupBalanceAlertAmount, setGroupBalanceAlertAmount] = useState('');
  const [groupInviteEmail, setGroupInviteEmail] = useState('');
  const [groupInvitePhone, setGroupInvitePhone] = useState('');
  const [groupInviteTargetId, setGroupInviteTargetId] = useState<number | null>(null);
  const [pendingGroupInvites, setPendingGroupInvites] = useState<SplitGroupDirectInvite[]>([]);
  const [pendingGroupInvitesLoading, setPendingGroupInvitesLoading] = useState(false);
  const [pendingInviteRevoke, setPendingInviteRevoke] = useState<SplitGroupDirectInvite | null>(
    null
  );
  const [selectedGroupFriendIds, setSelectedGroupFriendIds] = useState<number[]>([]);

  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(todayApiDate());
  const [billNotes, setBillNotes] = useState('');
  const [billGroupId, setBillGroupId] = useState<number | null>(null);
  const [isBillGroupLocked, setIsBillGroupLocked] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [pendingBillDelete, setPendingBillDelete] = useState<SplitBill | null>(null);
  const [expenseFlowScreen, setExpenseFlowScreen] = useState<ExpenseFlowScreen>('expense');
  /**
   * The expense split, in the composer's own key space: `me` for the author and
   * a friend id for everybody else. The group's shared default is translated
   * into these keys when a group is picked.
   */
  const [splitPayerKey, setSplitPayerKey] = useState<string>(CURRENT_USER_KEY);
  const [splitFullAmount, setSplitFullAmount] = useState(false);
  const [splitSelectedKeys, setSplitSelectedKeys] = useState<string[]>([]);
  const [adjustSplitTab, setAdjustSplitTab] = useState<AdjustSplitTab>('equally');
  const [splitWeights, setSplitWeights] = useState<SplitWeights>({});
  const [simplifyGroupDebts, setSimplifyGroupDebts] = useState(false);

  const [settlementFriendId, setSettlementFriendId] = useState<number | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(todayApiDate());
  const [settlementDirection, setSettlementDirection] =
    useState<SettlementDirection>('friend_paid_user');
  const [settlementNotes, setSettlementNotes] = useState('');

  const {
    entitlement,
    sheetVisible: upgradeSheetVisible,
    capture: captureEntitlement,
    dismiss: dismissUpgrade,
    clear: clearEntitlement,
  } = useEntitlementGate();

  /**
   * The single exit for anything that fails on this screen. The split ledger
   * is entitlement-gated, so a `402` has to reach the paywall rather than the
   * red banner — every catch block here goes through this.
   */
  const reportSplitError = useCallback(
    (splitError: unknown, fallback: string) => {
      if (captureEntitlement(splitError)) return;
      setError(formatFriendlySplitError(splitError, fallback));
    },
    [captureEntitlement]
  );

  const loadSplitData = useCallback(async () => {
    if (!token) {
      setFriends([]);
      setGroups([]);
      setBalances([]);
      setBills([]);
      setActivity([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLoadError(null);
    try {
      const [nextFriends, nextGroups, nextBalances, nextBills, nextActivity] = await Promise.all([
        fetchSplitFriends(token),
        fetchSplitGroups(token),
        fetchSplitBalances(token),
        fetchSplitBills(token),
        fetchSplitActivity(token),
      ]);
      setFriends(nextFriends);
      setGroups(nextGroups);
      setBalances(nextBalances);
      setBills(nextBills);
      setActivity(nextActivity);
      clearEntitlement();
    } catch (fetchError) {
      // Still through the entitlement gate first: a 402 on the split ledger is
      // the paywall's to answer, not a "check your connection".
      if (!captureEntitlement(fetchError)) {
        setLoadError(formatFriendlySplitError(fetchError, 'Unable to load split data.'));
      }
    } finally {
      setLoading(false);
    }
  }, [captureEntitlement, clearEntitlement, token]);

  useFocusEffect(
    useCallback(() => {
      void loadSplitData();
    }, [loadSplitData])
  );


  const loadDeviceContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const response = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
        ],
        sort: Contacts.SortTypes.FirstName,
        pageSize: 1000,
      });
      setDeviceContacts(
        response.data
          .map(toDeviceContactOption)
          .filter((contact): contact is DeviceContactOption => Boolean(contact))
      );
    } catch (contactError) {
      reportSplitError(contactError, 'Unable to load your contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, [reportSplitError]);

  const refreshContactsPermission = useCallback(async () => {
    try {
      const permission = await Contacts.getPermissionsAsync();
      setContactsPermissionStatus(permission.status);
      setContactsAccessPrivileges(permission.accessPrivileges ?? null);
      if (permission.granted) {
        await loadDeviceContacts();
      }
    } catch {
      setContactsPermissionStatus(Contacts.PermissionStatus.UNDETERMINED);
    }
  }, [loadDeviceContacts]);

  useEffect(() => {
    if (!memberPickerGroupId) return;
    void refreshContactsPermission();
  }, [memberPickerGroupId, refreshContactsPermission]);

  const totals = useMemo(() => {
    return balances.reduce(
      (acc, balance) => {
        if (balance.net_balance > 0) {
          acc.owedByFriends += balance.net_balance;
        } else {
          acc.owedToFriends += Math.abs(balance.net_balance);
        }
        return acc;
      },
      { owedByFriends: 0, owedToFriends: 0 }
    );
  }, [balances]);

  const overallNetBalance = totals.owedByFriends - totals.owedToFriends;
  const overallTone = getBalanceTone(overallNetBalance);

  /**
   * Whether the screen is drawing from an answer the server actually gave.
   *
   * All five collections start empty and stay empty on a failed load, so
   * "empty" and "unknown" are the same value in every one of them. This is the
   * only thing that tells them apart, and it is what decides between showing
   * the ledger with a warning over it and not pretending to have a ledger.
   */
  const hasSplitData =
    friends.length > 0 ||
    groups.length > 0 ||
    balances.length > 0 ||
    bills.length > 0 ||
    activity.length > 0;

  const screenState = splitScreenState({
    loading,
    loadFailed: !!loadError,
    hasData: hasSplitData,
  });

  const balanceByFriendId = useMemo(() => {
    return new Map(balances.map((balance) => [balance.friend.id, balance]));
  }, [balances]);

  const friendById = useMemo(() => {
    const map = new Map(friends.map((friend) => [friend.id, friend]));
    groups.forEach((group) => {
      group.members?.forEach((member) => {
        if (member.friend) map.set(member.friend.id, member.friend);
      });
    });
    bills.forEach((bill) => {
      bill.participants?.forEach((participant) => {
        if (participant.friend) map.set(participant.friend.id, participant.friend);
      });
    });
    return map;
  }, [bills, friends, groups]);

  const splitFriendCatalog = useMemo(() => [...friendById.values()], [friendById]);

  const groupSummaries = useMemo<SplitGroupSummary[]>(() => {
    return groups.map((group) => {
      const kind = group.kind ?? 'other';
      const memberIds = (group.members ?? []).map((member) => member.friend_id);
      const groupBills = bills.filter((bill) => bill.group_id === group.id);
      const groupBalancesByFriendId = new Map<number, number>();
      groupBills.forEach((bill) => {
        bill.participants?.forEach((participant) => {
          const current = groupBalancesByFriendId.get(participant.friend_id) ?? 0;
          const signedShare =
            participant.direction === 'friend_owes_user'
              ? participant.share_amount
              : -participant.share_amount;
          groupBalancesByFriendId.set(participant.friend_id, current + signedShare);
        });
      });
      const netBalance = [...groupBalancesByFriendId.values()].reduce(
        (sum, value) => sum + value,
        0
      );
      const latestBill = [...groupBills].sort((a, b) => b.date.localeCompare(a.date))[0];
      const detailLines = memberIds
        .map((memberId) => {
          const friend = friendById.get(memberId);
          const balance = groupBalancesByFriendId.get(memberId) ?? 0;
          if (!friend || balance === 0) return null;
          return balance > 0
            ? `${friend.name} owes you ${formatBalance(balance)}`
            : `You owe ${friend.name} ${formatBalance(balance)}`;
        })
        .filter((line): line is string => Boolean(line));

      return {
        group,
        billCount: groupBills.length,
        bills: [...groupBills].sort((a, b) => b.date.localeCompare(a.date)),
        detailLines,
        latestBill,
        kind,
        memberIds,
        netBalance,
      };
    });
  }, [bills, friendById, groups]);

  const selectedGroupSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === selectedGroupDetailId) ?? null,
    [groupSummaries, selectedGroupDetailId]
  );

  const groupSettingsSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === groupSettingsId) ?? null,
    [groupSettingsId, groupSummaries]
  );

  const groupActionSummary = useMemo(
    () =>
      groupAction
        ? (groupSummaries.find((summary) => summary.group.id === groupAction.groupId) ?? null)
        : null,
    [groupAction, groupSummaries]
  );

  const loadPendingGroupInvites = useCallback(
    async (groupId: number) => {
      if (!token) return;
      setPendingGroupInvitesLoading(true);
      try {
        setPendingGroupInvites(await fetchSplitGroupDirectInvites(token, groupId));
      } catch {
        setPendingGroupInvites([]);
      } finally {
        setPendingGroupInvitesLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!groupSettingsSummary?.group.viewer_can_manage) {
      setPendingGroupInvites([]);
      setPendingGroupInvitesLoading(false);
      return;
    }
    void loadPendingGroupInvites(groupSettingsSummary.group.id);
  }, [
    groupSettingsSummary?.group.id,
    groupSettingsSummary?.group.viewer_can_manage,
    loadPendingGroupInvites,
  ]);

  const friendDetailSummaries = useMemo<FriendDetailSummary[]>(() => {
    return friends.map((friend) => {
      const friendBills = bills
        .filter((bill) =>
          bill.participants?.some((participant) => participant.friend_id === friend.id)
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      const sharedGroups = groupSummaries.filter((summary) =>
        summary.memberIds.includes(friend.id)
      );
      const balance = balanceByFriendId.get(friend.id) ?? null;
      return {
        friend,
        balance,
        groups: sharedGroups,
        bills: friendBills,
        netBalance: balance?.net_balance ?? 0,
      };
    });
  }, [balanceByFriendId, bills, friends, groupSummaries]);

  const selectedFriendDetailSummary = useMemo(
    () =>
      friendDetailSummaries.find((summary) => summary.friend.id === selectedFriendDetailId) ?? null,
    [friendDetailSummaries, selectedFriendDetailId]
  );

  const selectedBill = useMemo(
    () => bills.find((bill) => bill.id === selectedBillId) ?? null,
    [bills, selectedBillId]
  );

  const memberPickerSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === memberPickerGroupId) ?? null,
    [groupSummaries, memberPickerGroupId]
  );

  const nonGroupSummary = useMemo(() => {
    const nonGroupBills = bills.filter((bill) => !bill.group_id);
    const participantBalances = new Map<number, number>();

    nonGroupBills.forEach((bill) => {
      bill.participants?.forEach((participant) => {
        const current = participantBalances.get(participant.friend_id) ?? 0;
        const signedShare =
          participant.direction === 'friend_owes_user'
            ? participant.share_amount
            : -participant.share_amount;
        participantBalances.set(participant.friend_id, current + signedShare);
      });
    });

    const netBalance = [...participantBalances.values()].reduce((sum, value) => sum + value, 0);
    const detailLines = [...participantBalances.entries()]
      .map(([friendId, value]) => {
        const friend = friendById.get(friendId);
        if (!friend || value === 0) return null;
        return value > 0
          ? `${friend.name} owes you ${formatBalance(value)}`
          : `You owe ${friend.name} ${formatBalance(value)}`;
      })
      .filter((line): line is string => Boolean(line))
      .slice(0, 2);
    const latestBill = [...nonGroupBills].sort((a, b) => b.date.localeCompare(a.date))[0];

    return {
      billCount: nonGroupBills.length,
      detailLines,
      latestBill,
      netBalance,
    };
  }, [bills, friendById]);

  const selectedBillGroup = useMemo(
    () => groups.find((group) => group.id === billGroupId) ?? null,
    [billGroupId, groups]
  );

  const reportMemberInvites = useCallback((invites: SplitGroupMemberInvite[]) => {
    const message = describeMemberInvites(invites);
    if (message) Alert.alert('Added to the group', message);
  }, []);

  const resolveFriendName = useCallback(
    (friendId: number) => friendById.get(friendId)?.name ?? 'Friend',
    [friendById]
  );

  const resolveFriendContact = useCallback(
    (friendId: number) => {
      const friend = friendById.get(friendId);
      return [friend?.phone, friend?.email].filter(Boolean).join(' • ');
    },
    [friendById]
  );

  const defaultSplitSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === defaultSplitGroupId) ?? null,
    [defaultSplitGroupId, groupSummaries]
  );

  const defaultSplitPeople = useMemo<SplitSlotPerson[]>(
    () =>
      defaultSplitSummary
        ? groupSplitSlots(
            defaultSplitSummary.group,
            resolveFriendName,
            resolveFriendContact,
            currentUserName,
            currentUserContact
          )
        : [],
    [
      currentUserContact,
      currentUserName,
      defaultSplitSummary,
      resolveFriendContact,
      resolveFriendName,
    ]
  );

  /** How one slot of a shared group reads in a sentence for this viewer. */
  const resolveSlotLabel = useCallback(
    (group: SplitGroup, slot: string) => {
      if (slot === viewerSplitSlot(group)) return currentUserName;
      if (slot === SPLIT_GROUP_OWNER_SLOT) return group.owner_name || 'Group owner';
      return resolveFriendName(Number(slot));
    },
    [currentUserName, resolveFriendName]
  );

  const billFriendOptions = useMemo(() => {
    if (selectedBillGroup?.members?.length) {
      return selectedBillGroup.members
        .map((member) => friendById.get(member.friend_id))
        .filter((friend): friend is SplitFriend => Boolean(friend));
    }
    return friends;
  }, [friendById, friends, selectedBillGroup]);

  const billSplitPeople = useMemo<SplitSlotPerson[]>(
    () => [
      { key: CURRENT_USER_KEY, label: currentUserName, subtitle: currentUserContact },
      ...billFriendOptions.map((friend) => ({
        key: friendSplitKey(friend.id),
        label: friend.name,
        subtitle: [friend.phone, friend.email].filter(Boolean).join(' • '),
      })),
    ],
    [billFriendOptions, currentUserContact, currentUserName]
  );

  const recentActivity = useMemo(() => {
    return activity.map((item) => {
      const fallbackCaption =
        item.type === 'group_created'
          ? `${item.participant_count ?? 0} member${item.participant_count === 1 ? '' : 's'}`
          : item.type === 'friend_created'
            ? 'Friend added'
            : item.type === 'bill'
              ? item.group?.name
                ? `${item.group.name} group`
                : `${item.participant_count ?? item.participants?.length ?? 0} share${
                    (item.participant_count ?? item.participants?.length ?? 0) === 1 ? '' : 's'
                  }`
              : 'Settlement';
      return {
        id: item.id,
        item,
        title: item.title,
        date: item.date,
        amount: item.amount,
        icon: getActivityIcon(item.type),
        caption: item.notes || fallbackCaption,
      };
    });
  }, [activity]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const balanceMatchesFilter = useCallback(
    (value: number) => {
      if (balanceFilter === 'all') return true;
      if (balanceFilter === 'open') return value !== 0;
      if (balanceFilter === 'owed_to_me') return value > 0;
      if (balanceFilter === 'i_owe') return value < 0;
      return value === 0;
    },
    [balanceFilter]
  );

  const visibleGroupSummaries = useMemo(() => {
    return groupSummaries.filter((summary) => {
      const searchText = [
        summary.group.name,
        ...summary.detailLines,
        ...summary.memberIds.map((memberId) => friendById.get(memberId)?.name ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const isNewEmptyGroup = summary.billCount === 0 && summary.netBalance === 0;
      const matchesBalance =
        balanceFilter === 'open' && isNewEmptyGroup
          ? true
          : balanceMatchesFilter(summary.netBalance);
      return matchesSearch && matchesBalance;
    });
  }, [balanceFilter, balanceMatchesFilter, friendById, groupSummaries, normalizedSearch]);

  const showNonGroupSummary =
    nonGroupSummary.billCount > 0 &&
    balanceMatchesFilter(nonGroupSummary.netBalance) &&
    (!normalizedSearch || 'non-group expenses'.includes(normalizedSearch));

  const visibleFriends = useMemo(() => {
    return friends.filter((friend) => {
      const balance = balanceByFriendId.get(friend.id);
      const netBalance = balance?.net_balance ?? 0;
      const searchText = [friend.name, friend.phone, friend.email].filter(Boolean).join(' ');
      const matchesSearch =
        !normalizedSearch || searchText.toLowerCase().includes(normalizedSearch);
      return matchesSearch && balanceMatchesFilter(netBalance);
    });
  }, [balanceByFriendId, balanceMatchesFilter, friends, normalizedSearch]);

  const visibleActivity = useMemo(() => {
    if (!normalizedSearch) return recentActivity;
    return recentActivity.filter((item) =>
      [item.title, item.caption].join(' ').toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, recentActivity]);

  const resetFriendForm = () => {
    setFriendName('');
    setFriendPhone('');
    setFriendEmail('');
  };

  const resetGroupForm = () => {
    setGroupName('');
    setGroupKind('trip');
    setGroupBalanceAlertEnabled(false);
    setGroupBalanceAlertAmount('');
    setSelectedGroupFriendIds([]);
  };

  const resetBillForm = () => {
    setBillTitle('');
    setBillAmount('');
    setBillDate(todayApiDate());
    setBillNotes('');
    setBillGroupId(null);
    setIsBillGroupLocked(false);
    setEditingBillId(null);
    setExpenseFlowScreen('expense');
    setSplitPayerKey(CURRENT_USER_KEY);
    setSplitFullAmount(false);
    setSplitSelectedKeys([CURRENT_USER_KEY, ...friends.map((friend) => friendSplitKey(friend.id))]);
    setAdjustSplitTab('equally');
    setSplitWeights({});
  };

  const resetSettlementForm = () => {
    setSettlementFriendId(friends[0]?.id ?? null);
    setSettlementAmount('');
    setSettlementDate(todayApiDate());
    setSettlementDirection('friend_paid_user');
    setSettlementNotes('');
  };

  const resetGroupInviteForm = () => {
    setGroupInviteEmail('');
    setGroupInvitePhone('');
    setGroupInviteTargetId(null);
  };

  const openModal = (kind: ModalKind) => {
    if (kind === 'friend') {
      resetFriendForm();
      setEditingFriendId(null);
    }
    if (kind === 'group') resetGroupForm();
    if (kind === 'bill') resetBillForm();
    if (kind === 'settlement') resetSettlementForm();
    if (kind === 'group_invite') resetGroupInviteForm();
    setError(null);
    setModal(kind);
  };

  const closeModal = () => {
    if (modal === 'friend') {
      setPendingFriendGroupId(null);
    }
    setModal(null);
    setSaving(false);
    setEditingFriendId(null);
    setEditingGroupId(null);
    setEditingBillId(null);
    setGroupInviteTargetId(null);
  };

  const handleSaveFriend = async () => {
    if (!token || saving) return;
    if (!friendName.trim()) {
      setError('Friend name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: friendName.trim(),
        phone: friendPhone.trim(),
        email: friendEmail.trim(),
      };
      const savedFriend = editingFriendId
        ? await updateSplitFriend(token, editingFriendId, payload)
        : await createSplitFriend(token, payload);
      if (!editingFriendId && pendingFriendGroupId) {
        const group = groups.find((currentGroup) => currentGroup.id === pendingFriendGroupId);
        if (group) {
          const nextFriendIds = [
            ...new Set([
              ...(group.members ?? []).map((member) => member.friend_id),
              savedFriend.id,
            ]),
          ];
          await updateSplitGroup(token, group.id, {
            name: group.name,
            kind: group.kind ?? 'other',
            friend_ids: nextFriendIds,
          });
          setSelectedGroupDetailId(group.id);
        }
        setPendingFriendGroupId(null);
      } else {
        setActiveSection('friends');
        setBalanceFilter('all');
        setSearchQuery('');
      }
      closeModal();
      await loadSplitData();
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to save this friend.');
    } finally {
      setSaving(false);
    }
  };

  const toggleGroupFriend = (friendId: number) => {
    setSelectedGroupFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((currentId) => currentId !== friendId)
        : [...current, friendId]
    );
  };

  const handleCreateGroup = async () => {
    if (!token || saving) return;
    if (!groupName.trim()) {
      setError('Group name is required.');
      return;
    }
    const isEditingGroup = Boolean(editingGroupId);
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: groupName.trim(),
        kind: groupKind,
        friend_ids: selectedGroupFriendIds,
      };
      const savedGroup = editingGroupId
        ? await updateSplitGroup(token, editingGroupId, payload)
        : await createSplitGroup(token, payload);
      reportMemberInvites(savedGroup.member_invites ?? []);
      setGroupBalanceAlertById((current) => ({
        ...current,
        [savedGroup.id]: {
          enabled: groupBalanceAlertEnabled,
          amount: groupBalanceAlertAmount.trim(),
        },
      }));
      closeModal();
      setActiveSection('groups');
      await loadSplitData();
      setSelectedGroupDetailId(isEditingGroup ? null : savedGroup.id);
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to save this group.');
    } finally {
      setSaving(false);
    }
  };

  const removeFriendFromActiveList = (friend: SplitFriend, action: 'archive' | 'delete') => {
    if (action === 'delete') {
      setSelectedFriendActions(null);
      setPendingFriendDelete(friend);
      return;
    }

    const title = action === 'archive' ? `Archive ${friend.name}?` : `Delete ${friend.name}?`;
    const message =
      action === 'archive'
        ? 'Archived friends stay out of new split bills.'
        : 'This removes the friend from active split lists while preserving past split records.';
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'archive' ? 'Archive' : 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!token) return;
          setError(null);
          setSelectedFriendActions(null);
          void archiveSplitFriend(token, friend.id)
            .then(loadSplitData)
            .catch((archiveError: unknown) => {
              reportSplitError(archiveError, 'Unable to archive friend.');
            });
        },
      },
    ]);
  };

  const confirmDeleteFriend = () => {
    if (!token || !pendingFriendDelete || saving) return;
    setSaving(true);
    setError(null);
    void archiveSplitFriend(token, pendingFriendDelete.id)
      .then(loadSplitData)
      .catch((archiveError: unknown) => {
        reportSplitError(archiveError, 'Unable to delete friend.');
      })
      .finally(() => {
        setSaving(false);
        setPendingFriendDelete(null);
      });
  };

  const handleArchiveFriend = (friend: SplitFriend) => {
    removeFriendFromActiveList(friend, 'archive');
  };

  const openFriendEditor = (friend: SplitFriend) => {
    setSelectedFriendActions(null);
    setFriendName(friend.name);
    setFriendPhone(friend.phone ?? '');
    setFriendEmail(friend.email ?? '');
    setEditingFriendId(friend.id);
    setPendingFriendGroupId(null);
    setError(null);
    setModal('friend');
  };

  const openFriendDetail = (friendId: number) => {
    setSelectedFriendActions(null);
    setSelectedFriendDetailId(friendId);
  };

  const handleSelectBillGroup = (groupId: number | null) => {
    const nextGroup = groups.find((group) => group.id === groupId) ?? null;
    const memberKeys = [
      ...new Set(
        nextGroup?.members?.map((member) => friendSplitKey(member.friend_id)).filter(Boolean) ??
          friends.map((friend) => friendSplitKey(friend.id))
      ),
    ];
    setBillGroupId(groupId);

    /**
     * The whole point of a group default is that the split screen stops being a
     * stop on the way to saving an expense — so it is applied the moment the
     * group is known, not asked for again.
     */
    const groupDefault = nextGroup?.default_split ?? null;
    const translated = nextGroup && groupDefault
      ? defaultSplitToComposerKeys(nextGroup, groupDefault)
      : null;
    // The default names people by the owner's friend rows. Anything that no
    // longer maps — a member who has left, or the owner themselves seen from
    // another member's expense composer, which can only name that member's own
    // friends — falls back to an equal split of the group rather than a
    // half-applied one.
    const usable =
      translated != null &&
      translated.participantKeys.every(
        (key) => key === CURRENT_USER_KEY || memberKeys.includes(key)
      ) &&
      (translated.payerKey === CURRENT_USER_KEY || memberKeys.includes(translated.payerKey));

    if (!usable || !groupDefault) {
      setSplitPayerKey(CURRENT_USER_KEY);
      setSplitFullAmount(false);
      setSplitSelectedKeys([CURRENT_USER_KEY, ...memberKeys]);
      setAdjustSplitTab('equally');
      setSplitWeights({});
      return;
    }

    setSplitPayerKey(translated.payerKey);
    setSplitFullAmount(Boolean(groupDefault.full_amount));
    setSplitSelectedKeys(translated.participantKeys);
    setAdjustSplitTab(groupDefault.tab);
    setSplitWeights(translated.weights);
  };

  const billSplitSelection = useMemo<SplitSelection>(
    () => ({
      selfKey: CURRENT_USER_KEY,
      payerKey: splitPayerKey,
      fullAmount: splitFullAmount,
      participantKeys: splitSelectedKeys,
      tab: adjustSplitTab,
      weights: splitWeights,
    }),
    [adjustSplitTab, splitFullAmount, splitPayerKey, splitSelectedKeys, splitWeights]
  );

  const buildParticipantsFromSplitChoice = (): ParticipantDraft[] | null => {
    const built = buildParticipantsFromSelection(billSplitSelection, parseAmount(billAmount));
    if (!built.ok) {
      setError(built.error);
      return null;
    }
    return built.participants;
  };

  const applySplitChoice = () => {
    const nextParticipants = buildParticipantsFromSplitChoice();
    if (!nextParticipants) return;
    setExpenseFlowScreen('expense');
    setError(null);
  };

  const resolveSplitExpenseAccount = async (authToken: string) => {
    const accounts = await fetchAccounts(authToken);
    const cashAccount =
      getPreferredAccountForPaymentMode(accounts, 'Cash') ??
      accounts.find((account) => account.is_default) ??
      accounts[0] ??
      null;
    if (!cashAccount) {
      throw new Error('Add an account before saving this split expense.');
    }
    return cashAccount;
  };

  const createEntryBackedSplitBill = async (
    authToken: string,
    amount: number,
    participants: ParticipantDraft[]
  ) => {
    const account = await resolveSplitExpenseAccount(authToken);
    await createEntry(
      authToken,
      {
        title: billTitle.trim(),
        amount: toAmountString(amount),
        currency: 'INR',
        account_id: account.id,
        type: 'expense',
        mode: 'Cash',
        category: 'Split',
        notes: billNotes.trim(),
        merchant: '',
        tag: 'Split',
        date: billDate.trim(),
        time: '',
        source: 'manual',
        source_text: '',
        split: {
          group_id: billGroupId,
          notes: billNotes.trim(),
          participants: participants.map((participant) => ({
            friend_id: participant.friend_id,
            share_amount: participant.share_amount,
            direction: participant.direction,
          })),
        },
      },
      `split-bill-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  };

  const handleCreateBill = async () => {
    if (!token || saving) return;
    const amount = parseAmount(billAmount);
    if (!billTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Add a title, total amount, and at least one friend share.');
      return;
    }
    const finalParticipants = buildParticipantsFromSplitChoice();
    if (!finalParticipants || finalParticipants.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const payload: SplitBillPayload = {
        title: billTitle.trim(),
        total_amount: amount,
        currency: 'INR',
        date: billDate.trim(),
        notes: billNotes.trim(),
        group_id: billGroupId,
        participants: finalParticipants,
      };
      const shouldMirrorToTransaction = !editingBillId && splitPayerKey === CURRENT_USER_KEY;
      const savedBill = editingBillId
        ? await updateSplitBill(token, editingBillId, payload)
        : shouldMirrorToTransaction
          ? null
          : await createSplitBill(token, payload);
      if (shouldMirrorToTransaction) {
        await createEntryBackedSplitBill(token, amount, finalParticipants);
      }
      closeModal();
      await loadSplitData();
      const nextGroupId = savedBill?.group_id ?? billGroupId;
      if (nextGroupId) {
        setSelectedGroupDetailId(nextGroupId);
      }
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to save this split bill.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteBill = () => {
    if (!token || !pendingBillDelete || saving) return;
    const groupId = pendingBillDelete.group_id ?? null;
    setSaving(true);
    setError(null);
    void deleteSplitBill(token, pendingBillDelete.id)
      .then(async () => {
        setPendingBillDelete(null);
        setSelectedBillId(null);
        await loadSplitData();
        if (groupId) {
          setSelectedGroupDetailId(groupId);
        }
      })
      .catch((deleteError: unknown) => {
        reportSplitError(deleteError, 'Unable to delete this expense.');
      })
      .finally(() => setSaving(false));
  };

  const handleCreateSettlement = async () => {
    if (!token || saving) return;
    const amount = parseAmount(settlementAmount);
    if (!settlementFriendId || !Number.isFinite(amount) || amount <= 0) {
      setError('Choose a friend and enter a positive settlement amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSplitSettlement(token, {
        friend_id: settlementFriendId,
        amount,
        direction: settlementDirection,
        date: settlementDate.trim(),
        notes: settlementNotes.trim(),
      });
      closeModal();
      await loadSplitData();
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to record this settlement.');
    } finally {
      setSaving(false);
    }
  };

  const openContextCreate = () => {
    if (activeSection === 'friends') {
      openModal('friend');
      return;
    }
    openModal('group');
  };

  const openExpenseComposer = () => {
    if (friends.length > 0) {
      openModal('bill');
      return;
    }
    openModal('friend');
  };

  const openGroupEditor = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    setGroupSettingsId(null);
    setGroupName(summary.group.name);
    setGroupKind(summary.kind);
    setGroupBalanceAlertEnabled(groupBalanceAlertById[summary.group.id]?.enabled ?? false);
    setGroupBalanceAlertAmount(groupBalanceAlertById[summary.group.id]?.amount ?? '');
    setSelectedGroupFriendIds(summary.memberIds);
    setEditingGroupId(summary.group.id);
    setError(null);
    setModal('group');
  };

  const openDefaultSplitEditor = (summary: SplitGroupSummary) => {
    const group = summary.group;
    const slotKeys = groupSplitSlots(
      group,
      resolveFriendName,
      resolveFriendContact,
      currentUserName,
      currentUserContact
    ).map((person) => person.key);
    const stored = group.default_split ?? null;
    // A stored default written against a roster that has since changed cannot
    // be edited meaningfully, so it opens as a fresh equal split of who is in
    // the group now.
    const storedMatchesRoster =
      stored != null &&
      slotKeys.includes(stored.payer) &&
      stored.participants.every((participant) => slotKeys.includes(participant.slot));

    setDefaultSplitGroupId(group.id);
    setDefaultSplitDraft(
      storedMatchesRoster && stored
        ? defaultSplitToSelection(group, stored)
        : {
            selfKey: viewerSplitSlot(group),
            payerKey: viewerSplitSlot(group),
            fullAmount: false,
            participantKeys: slotKeys,
            tab: 'equally',
            weights: {},
          }
    );
    setDefaultSplitScreen('choice');
    setDefaultSplitError(null);
    setGroupSettingsId(null);
  };

  const closeDefaultSplitEditor = () => {
    const returnToGroupId = defaultSplitGroupId;
    setDefaultSplitGroupId(null);
    setDefaultSplitDraft(null);
    setDefaultSplitError(null);
    setGroupSettingsId(returnToGroupId);
  };

  const saveDefaultSplit = async () => {
    if (!token || !defaultSplitGroupId || !defaultSplitDraft || saving) return;
    if (!isDefaultSplitTab(defaultSplitDraft.tab)) {
      setDefaultSplitError('A default split has to be a ratio, not exact amounts.');
      return;
    }
    const keys = splitParticipantKeys(defaultSplitDraft);
    if (keys.length === 0) {
      setDefaultSplitError('Choose at least one person for this split.');
      return;
    }
    /**
     * Checked here rather than on the next expense: a default whose percentages
     * do not reach 100 would otherwise sit in settings looking saved and fail
     * every time it was used.
     */
    const check = computeSplitShares({
      amount: 100,
      tab: defaultSplitDraft.tab,
      keys,
      weights: defaultSplitDraft.weights,
    });
    if (!check.ok) {
      setDefaultSplitError(check.error);
      return;
    }
    const payload = selectionToDefaultSplit(defaultSplitDraft);
    setSaving(true);
    try {
      await setSplitGroupDefaultSplit(token, defaultSplitGroupId, payload);
      closeDefaultSplitEditor();
      await loadSplitData();
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to save this default split.');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaultSplit = async () => {
    if (!token || !defaultSplitGroupId || saving) return;
    setSaving(true);
    try {
      await setSplitGroupDefaultSplit(token, defaultSplitGroupId, null);
      closeDefaultSplitEditor();
      await loadSplitData();
    } catch (resetError) {
      reportSplitError(resetError, 'Unable to remove this default split.');
    } finally {
      setSaving(false);
    }
  };

  const openMemberPicker = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    setSelectedGroupDetailId(null);
    setGroupSettingsId(null);
    setMemberPickerGroupId(summary.group.id);
    setMemberPickerFriendIds(summary.memberIds);
    setMemberSearchQuery('');
    setError(null);
  };

  const shareGroupInviteLink = async (summary: SplitGroupSummary) => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const invite = await createSplitGroupInviteLink(token, summary.group.id);
      await Share.share({
        title: `Join ${summary.group.name} on Finnri`,
        message: `Join ${summary.group.name} on Finnri to track shared expenses together: ${invite.url}`,
        url: invite.url,
      });
    } catch (inviteError) {
      reportSplitError(inviteError, 'Unable to share this invite link.');
    } finally {
      setSaving(false);
    }
  };

  const openDirectGroupInvite = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    setGroupSettingsId(null);
    resetGroupInviteForm();
    setGroupInviteTargetId(summary.group.id);
    setError(null);
    setModal('group_invite');
  };

  const handleSendGroupInvite = async () => {
    if (!token || saving || !groupInviteTargetId) return;
    const email = groupInviteEmail.trim();
    const phone = groupInvitePhone.trim();
    if (!email && !phone) {
      setError('Enter an email or phone number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const invite = await createSplitGroupDirectInvite(token, groupInviteTargetId, {
        email,
        phone,
      });
      await Share.share({
        title: `Join ${invite.group.name} on Finnri`,
        message: invite.message,
        url: invite.url,
      });
      closeModal();
      setGroupSettingsId(invite.group.id);
      await loadPendingGroupInvites(invite.group.id);
    } catch (inviteError) {
      reportSplitError(inviteError, 'Unable to invite this friend.');
    } finally {
      setSaving(false);
    }
  };

  const sharePendingGroupInvite = async (invite: SplitGroupDirectInvite) => {
    if (!invite.message && !invite.url) return;
    await Share.share({
      title: `Join ${invite.group.name} on Finnri`,
      message: invite.message || invite.url,
      url: invite.url,
    });
  };

  const confirmRevokeGroupInvite = () => {
    if (!token || !pendingInviteRevoke || saving) return;
    const groupId = pendingInviteRevoke.group.id;
    setSaving(true);
    setError(null);
    void revokeSplitGroupDirectInvite(token, groupId, pendingInviteRevoke.id)
      .then(async () => {
        setPendingInviteRevoke(null);
        await loadPendingGroupInvites(groupId);
      })
      .catch((revokeError: unknown) => {
        reportSplitError(revokeError, 'Unable to revoke this invite.');
      })
      .finally(() => setSaving(false));
  };

  const closeMemberPicker = (returnToGroup = true) => {
    const groupId = memberPickerGroupId;
    setMemberPickerGroupId(null);
    setMemberPickerFriendIds([]);
    setMemberSearchQuery('');
    if (returnToGroup && groupId) {
      setSelectedGroupDetailId(groupId);
    }
  };

  const toggleMemberPickerFriend = (friendId: number) => {
    setMemberPickerFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((currentId) => currentId !== friendId)
        : [...current, friendId]
    );
  };

  const handleSaveGroupMembers = async () => {
    if (!token || saving || !memberPickerSummary) return;
    if (!memberPickerSummary.group.viewer_can_manage) return;
    setSaving(true);
    setError(null);
    try {
      const savedGroup = await updateSplitGroup(token, memberPickerSummary.group.id, {
        name: memberPickerSummary.group.name,
        kind: memberPickerSummary.kind,
        friend_ids: memberPickerFriendIds,
      });
      reportMemberInvites(savedGroup.member_invites ?? []);
      const groupId = memberPickerSummary.group.id;
      closeMemberPicker(false);
      setSelectedGroupDetailId(groupId);
      await loadSplitData();
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to update group members.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    setPendingGroupDelete(summary);
  };

  const handleLeaveGroup = (summary: SplitGroupSummary) => {
    if (summary.group.viewer_can_manage) return;
    setPendingGroupLeave(summary);
  };

  const confirmDeleteGroup = () => {
    if (!token || !pendingGroupDelete || saving) return;
    const removedGroupId = pendingGroupDelete.group.id;
    setSaving(true);
    setError(null);
    void archiveSplitGroup(token, removedGroupId)
      .then(async () => {
        setPendingGroupDelete(null);
        setGroupSettingsId(null);
        setSelectedGroupDetailId(null);
        await loadSplitData();
      })
      .catch((deleteError: unknown) => {
        reportSplitError(deleteError, 'Unable to delete this split group.');
      })
      .finally(() => setSaving(false));
  };

  const confirmLeaveGroup = () => {
    if (!token || !pendingGroupLeave || saving) return;
    setSaving(true);
    setError(null);
    const leftGroupId = pendingGroupLeave.group.id;
    void leaveSplitGroup(token, leftGroupId)
      .then(async () => {
        setPendingGroupLeave(null);
        setGroupSettingsId(null);
        setSelectedGroupDetailId(null);
        await loadSplitData();
      })
      .catch((leaveError: unknown) => {
        reportSplitError(leaveError, 'Unable to leave this split group.');
      })
      .finally(() => setSaving(false));
  };

  const requestContactsAccess = async () => {
    setContactsLoading(true);
    setError(null);
    try {
      const permission = await Contacts.requestPermissionsAsync();
      setContactsPermissionStatus(permission.status);
      setContactsAccessPrivileges(permission.accessPrivileges ?? null);
      if (permission.granted) {
        await loadDeviceContacts();
      }
    } catch (permissionError) {
      reportSplitError(permissionError, 'Unable to request contacts permission.');
    } finally {
      setContactsLoading(false);
    }
  };

  const selectDeviceContact = async (contact: DeviceContactOption) => {
    if (!token || saving) return;
    const existingFriend = friends.find((friend) => contactMatchesFriend(contact, friend));
    if (existingFriend) {
      setMemberPickerFriendIds((current) =>
        current.includes(existingFriend.id) ? current : [...current, existingFriend.id]
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const createdFriend = await createSplitFriend(token, {
        name: contact.name,
        phone: contact.phone ?? '',
        email: contact.email ?? '',
      });
      setMemberPickerFriendIds((current) =>
        current.includes(createdFriend.id) ? current : [...current, createdFriend.id]
      );
      await loadSplitData();
    } catch (saveError) {
      reportSplitError(saveError, 'Unable to add this contact.');
    } finally {
      setSaving(false);
    }
  };

  const openFriendComposerFromMembers = () => {
    if (!memberPickerGroupId) return;
    const prefilledName = memberSearchQuery.trim();
    setPendingFriendGroupId(memberPickerGroupId);
    closeMemberPicker(false);
    openModal('friend');
    if (prefilledName) {
      setFriendName(prefilledName);
    }
  };

  const openBillForGroup = (groupId: number) => {
    const group = groups.find((candidate) => candidate.id === groupId) ?? null;
    const groupHasMembers = Boolean(
      group?.members?.some((member) => friendById.has(member.friend_id))
    );
    if (!groupHasMembers && friends.length === 0) {
      setSelectedGroupDetailId(null);
      openModal('friend');
      return;
    }
    resetBillForm();
    handleSelectBillGroup(groupId);
    setIsBillGroupLocked(true);
    setSelectedGroupDetailId(null);
    setModal('bill');
  };

  const openBillForFriend = (friendId: number) => {
    const friend = friends.find((candidate) => candidate.id === friendId);
    if (!friend) return;
    resetBillForm();
    setBillGroupId(null);
    setSplitPayerKey(CURRENT_USER_KEY);
    setSplitFullAmount(false);
    setSplitSelectedKeys([CURRENT_USER_KEY, friendSplitKey(friend.id)]);
    setSelectedFriendDetailId(null);
    setModal('bill');
  };

  const openBillEditor = (bill: SplitBill) => {
    const groupId = bill.group_id ?? null;
    const friendIds = bill.participants?.map((participant) => participant.friend_id) ?? [];
    const userOwesParticipant = bill.participants?.find(
      (participant) => participant.direction === 'user_owes_friend'
    );
    const friendOwesParticipants =
      bill.participants?.filter((participant) => participant.direction === 'friend_owes_user') ??
      [];
    const friendOwesTotal = friendOwesParticipants.reduce(
      (sum, participant) => sum + participant.share_amount,
      0
    );

    setBillTitle(bill.title);
    setBillAmount(String(bill.total_amount));
    setBillDate(bill.date || todayApiDate());
    setBillNotes(bill.notes ?? '');
    setBillGroupId(groupId);
    setIsBillGroupLocked(Boolean(groupId));
    setEditingBillId(bill.id);
    setExpenseFlowScreen('expense');
    const includesCurrentUser = userOwesParticipant
      ? userOwesParticipant.share_amount < bill.total_amount
      : friendOwesTotal < bill.total_amount;
    setSplitPayerKey(
      userOwesParticipant ? friendSplitKey(userOwesParticipant.friend_id) : CURRENT_USER_KEY
    );
    setSplitFullAmount(!includesCurrentUser);
    setSplitSelectedKeys([
      ...(includesCurrentUser ? [CURRENT_USER_KEY] : []),
      ...new Set(friendIds.map(friendSplitKey)),
    ]);
    setAdjustSplitTab('equally');
    setSplitWeights({});
    setSelectedBillId(null);
    setSelectedGroupDetailId(null);
    setError(null);
    setModal('bill');
  };

  const openSettlementForFriend = (friendId: number) => {
    const friend = friends.find((candidate) => candidate.id === friendId);
    if (!friend) return;
    resetSettlementForm();
    setSettlementFriendId(friend.id);
    setSelectedFriendDetailId(null);
    setModal('settlement');
  };

  const openGroupAction = (summary: SplitGroupSummary, mode: GroupActionMode) => {
    setGroupAction({ groupId: summary.group.id, mode });
  };

  const openSettlementForGroupFriend = (
    summary: SplitGroupSummary,
    friendId: number,
    balance: number
  ) => {
    if (balance === 0) return;
    const friend = friends.find((candidate) => candidate.id === friendId);
    if (!friend) return;
    resetSettlementForm();
    setSettlementFriendId(friend.id);
    setSettlementAmount(toAmountString(Math.abs(balance)));
    setSettlementDirection(balance > 0 ? 'friend_paid_user' : 'user_paid_friend');
    setSettlementNotes(`Settlement for ${summary.group.name}`);
    setGroupAction(null);
    setModal('settlement');
  };

  const shareGroupExport = async (summary: SplitGroupSummary) => {
    try {
      const csv = buildGroupExportCsv(summary, friends, currentUserName);
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!FileSystem.documentDirectory || !sharingAvailable) {
        await Share.share({
          title: `${summary.group.name} Finnri split export`,
          message: csv,
        });
        return;
      }
      const fileName = `${getSafeExportFileName(summary.group.name)}-split-export-${todayApiDate()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: `${summary.group.name} Finnri split export`,
      });
    } catch (shareError) {
      reportSplitError(shareError, 'Unable to export this group summary.');
    }
  };

  const openActivityTarget = (item: SplitActivityItem) => {
    const targetGroupId = item.group_id ?? item.group?.id ?? null;
    if (targetGroupId && groupSummaries.some((summary) => summary.group.id === targetGroupId)) {
      setSelectedFriendDetailId(null);
      setSelectedGroupDetailId(targetGroupId);
      return;
    }

    if (item.type === 'bill') {
      const bill = bills.find((candidate) => candidate.id === item.record_id);
      if (bill?.entry_id) {
        router.push({ pathname: '/entry/[id]', params: { id: String(bill.entry_id) } });
        return;
      }
      const participantFriendId = bill?.participants?.[0]?.friend_id;
      if (participantFriendId) {
        openFriendDetail(participantFriendId);
        return;
      }
    }

    const targetFriendId = item.friend_id ?? item.friend?.id ?? item.participants?.[0]?.friend_id;
    if (targetFriendId && friends.some((friend) => friend.id === targetFriendId)) {
      openFriendDetail(targetFriendId);
      return;
    }

    Alert.alert('Activity details', 'This activity is not linked to a detail page yet.');
  };

  if (screenState === 'loading') {
    return (
      <SplitScreenFrame embedded={embedded} backgroundColor={theme.background}>
        <SkeletonFrame label="Loading splits" testID="split-skeleton" style={{ paddingTop: 16 }}>
          <SkeletonRows count={5} lines={2} />
        </SkeletonFrame>
      </SplitScreenFrame>
    );
  }

  const renderFriendChip = (
    friend: SplitFriend,
    selectedId: number | null,
    onSelect: (id: number) => void
  ) => {
    const isSelected = friend.id === selectedId;
    return (
      <Pressable
        key={friend.id}
        accessibilityRole="button"
        onPress={() => onSelect(friend.id)}
        className="rounded-2xl px-3 py-2"
        style={{
          borderWidth: 1,
          borderColor: isSelected ? theme.accent : borderColor,
          backgroundColor: isSelected ? theme.accent : 'transparent',
        }}>
        <TText
          className="text-xs"
          style={{ color: isSelected ? '#FFFFFF' : theme.text, fontFamily: Fonts.title }}>
          {friend.name}
        </TText>
      </Pressable>
    );
  };

  const renderFriendRow = (friend: SplitFriend) => {
    const balance = balanceByFriendId.get(friend.id);
    const netBalance = balance?.net_balance ?? 0;
    const isReceivable = netBalance > 0;
    const isPayable = netBalance < 0;
    const amountColor = isReceivable ? '#16A34A' : isPayable ? '#DC2626' : theme.text;
    const balanceLabel = isReceivable ? 'owes you' : isPayable ? 'you owe' : 'settled';

    return (
      <View key={friend.id} className="flex-row items-center gap-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${friend.name}`}
          onPress={() => openFriendDetail(friend.id)}
          onLongPress={() => setSelectedFriendActions(friend)}
          className="flex-1 flex-row items-center gap-4">
          <View
            className="h-[58px] w-[58px] items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <TText className="text-lg" style={{ color: theme.accent, fontFamily: Fonts.title }}>
              {friend.name.charAt(0).toUpperCase()}
            </TText>
          </View>
          <View className="flex-1">
            <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
              {friend.name}
            </TText>
            <TText className="mt-1 text-xs text-black/60 dark:text-white/60">
              {[friend.phone, friend.email].filter(Boolean).join(' • ') || 'No contact saved'}
            </TText>
            <TText className="mt-1 text-sm" style={{ color: amountColor, fontFamily: Fonts.title }}>
              {formatBalance(netBalance)} {balanceLabel}
            </TText>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Archive ${friend.name}`}
          onPress={() => handleArchiveFriend(friend)}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.secondary }}>
          <MaterialCommunityIcons name="archive-outline" size={18} color={theme.text} />
        </Pressable>
      </View>
    );
  };

  const renderGroupCard = (summary: SplitGroupSummary) => {
    const { group, detailLines, memberIds, kind, netBalance, billCount, latestBill } = summary;
    const tone = getBalanceTone(netBalance);
    const kindConfig = getGroupKindConfig(kind);
    const memberNames = memberIds
      .map((memberId) => friendById.get(memberId)?.name)
      .filter(Boolean)
      .join(', ');

    return (
      <Pressable
        key={group.id}
        accessibilityRole="button"
        onPress={() => setSelectedGroupDetailId(group.id)}
        className="flex-row gap-4 py-2">
        <GroupTile variant={kindConfig.variant} icon={kindConfig.icon} />
        <View className="flex-1 justify-center">
          <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
            {group.name}
          </TText>
          <TText className="mt-1 text-base" style={{ color: tone.color, fontFamily: Fonts.title }}>
            {tone.label}
          </TText>
          {detailLines.length > 0 ? (
            detailLines.map((line) => (
              <TText
                key={line}
                className="mt-1 text-sm text-black/55 dark:text-white/55"
                numberOfLines={1}>
                {line}
              </TText>
            ))
          ) : (
            <TText className="mt-1 text-sm text-black/55 dark:text-white/55" numberOfLines={1}>
              {latestBill
                ? `${billCount} bill${billCount === 1 ? '' : 's'} • last on ${latestBill.date}`
                : memberNames || 'No expenses yet'}
            </TText>
          )}
        </View>
      </Pressable>
    );
  };

  const renderNonGroupRow = () => {
    const tone = getBalanceTone(nonGroupSummary.netBalance);
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openModal('bill')}
        className="flex-row gap-4 py-2">
        <GroupTile variant={5} icon="receipt-text-outline" />
        <View className="flex-1 justify-center">
          <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
            Non-group expenses
          </TText>
          <TText className="mt-1 text-base" style={{ color: tone.color, fontFamily: Fonts.title }}>
            {tone.label}
          </TText>
          {nonGroupSummary.detailLines.length > 0 ? (
            nonGroupSummary.detailLines.map((line) => (
              <TText
                key={line}
                className="mt-1 text-sm text-black/55 dark:text-white/55"
                numberOfLines={1}>
                {line}
              </TText>
            ))
          ) : (
            <TText className="mt-1 text-sm text-black/55 dark:text-white/55" numberOfLines={1}>
              {nonGroupSummary.latestBill
                ? `${nonGroupSummary.billCount} bill${
                    nonGroupSummary.billCount === 1 ? '' : 's'
                  } • last on ${nonGroupSummary.latestBill.date}`
                : 'Personal shared expenses'}
            </TText>
          )}
        </View>
      </Pressable>
    );
  };

  const renderActivityRow = (item: (typeof recentActivity)[number]) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={`Open activity ${item.title}`}
      onPress={() => openActivityTarget(item.item)}
      className="flex-row items-center gap-4 py-2">
      <View
        className="h-[58px] w-[58px] items-center justify-center rounded-xl"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name={item.icon} size={26} color={theme.accent} />
      </View>
      <View className="flex-1">
        <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
          {item.title}
        </TText>
        <TText className="mt-1 text-xs text-black/60 dark:text-white/60">
          {item.caption} • {item.date}
        </TText>
      </View>
      {item.amount != null ? (
        <TText className="text-sm" style={{ color: theme.text, fontFamily: Fonts.title }}>
          {formatBalance(item.amount)}
        </TText>
      ) : null}
    </Pressable>
  );

  return (
    <SplitScreenFrame embedded={embedded} backgroundColor={theme.background}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: embedded ? 14 : 10,
            paddingBottom: 136,
          }}>
          {!embedded && (
            <SplitTopBar
              loading={loading}
              activeSection={activeSection}
              searchVisible={searchVisible}
              onToggleSearch={() => setSearchVisible((current) => !current)}
              onCreate={openContextCreate}
            />
          )}

          {searchVisible && (
            <SearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
            />
          )}

          {error && <ErrorBanner message={error} style={{ marginTop: 16 }} />}

          {/* A load that failed on top of a ledger we already have is a
              warning, not a wall: the figures below are real, just possibly a
              few minutes old, and blanking them would cost the user more than
              the staleness does. The retry is on the banner because there is
              nowhere else on the screen it would belong. */}
          {loadError && screenState === 'ledger' ? (
            <ErrorBanner
              message={loadError}
              onRetry={() => void loadSplitData()}
              retryLabel="Try again"
              style={{ marginTop: 16 }}
            />
          ) : null}

          {loadError && screenState === 'unavailable' ? (
            <View className="mt-8">
              <InlineEmptyState
                icon="wifi-off"
                title="Splits did not load"
                message={loadError}
                actionLabel="Try again"
                onAction={() => void loadSplitData()}
              />
            </View>
          ) : (
            <>
            <SegmentedSections activeSection={activeSection} onChange={setActiveSection} />

            {activeSection !== 'activity' ? (
              <View className="mt-7 flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
                    Overall, {overallTone.label}
                  </TText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filter split balances"
                  onPress={() => setFilterSheetVisible(true)}
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.secondary }}>
                  <MaterialCommunityIcons name="tune-variant" size={24} color={theme.text} />
                </Pressable>
              </View>
            ) : null}

            {activeSection === 'groups' && (
              <View className="mt-6 gap-5">
                {visibleGroupSummaries.length > 0 || showNonGroupSummary ? (
                  <>
                    {visibleGroupSummaries.map(renderGroupCard)}
                    {showNonGroupSummary ? renderNonGroupRow() : null}
                    {balanceFilter !== 'settled' ? (
                      <SettledHint
                        settledCount={
                          groups.filter((group) => {
                            const memberIds = (group.members ?? []).map((member) => member.friend_id);
                            return memberIds.every(
                              (memberId) => (balanceByFriendId.get(memberId)?.net_balance ?? 0) === 0
                            );
                          }).length
                        }
                        onShowSettled={() => {
                          setBalanceFilter('settled');
                          setFilterSheetVisible(false);
                        }}
                      />
                    ) : null}
                  </>
                ) : (
                  <InlineEmptyState
                    icon="account-group-outline"
                    title={normalizedSearch ? 'No matching groups' : 'Create your first group'}
                    message={
                      normalizedSearch
                        ? 'Try another search or balance filter.'
                        : 'Start a group now. Members can be added later.'
                    }
                    actionLabel={normalizedSearch ? undefined : 'New group'}
                    onAction={() => openModal('group')}
                  />
                )}
              </View>
            )}

            {activeSection === 'friends' && (
              <View className="mt-6 gap-4">
                {visibleFriends.length > 0 ? (
                  visibleFriends.map(renderFriendRow)
                ) : (
                  <InlineEmptyState
                    icon={
                      friends.length === 0
                        ? 'account-multiple-plus-outline'
                        : 'account-search-outline'
                    }
                    title={normalizedSearch ? 'No matching friends' : 'Add friends to split bills'}
                    message={
                      normalizedSearch
                        ? 'Try another search or balance filter.'
                        : 'Create friends, then add them to groups, bills, and settlements.'
                    }
                    actionLabel={normalizedSearch ? undefined : 'Add friend'}
                    onAction={() => openModal('friend')}
                  />
                )}
              </View>
            )}

            {activeSection === 'activity' && (
              <View className="mt-9 gap-4">
                <View className="mb-2">
                  <TText className="text-2xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                    Recent activity
                  </TText>
                </View>
                {visibleActivity.length > 0 ? (
                  visibleActivity.map(renderActivityRow)
                ) : (
                  <InlineEmptyState
                    icon="history"
                    title={normalizedSearch ? 'No matching activity' : 'No activity yet'}
                    message={
                      normalizedSearch
                        ? 'Try another search.'
                        : 'Group, friend, bill, and settlement activity will appear here.'
                    }
                  />
                )}
              </View>
            )}
            </>
          )}
        </ScrollView>

        {friends.length > 0 ? <FloatingExpenseButton onPress={openExpenseComposer} /> : null}

        <BalanceFilterSheet
          visible={filterSheetVisible}
          selectedFilter={balanceFilter}
          onSelect={(nextFilter) => {
            setBalanceFilter(nextFilter);
            setFilterSheetVisible(false);
          }}
          onClose={() => setFilterSheetVisible(false)}
        />

        <FriendActionsSheet
          friend={selectedFriendActions}
          onClose={() => setSelectedFriendActions(null)}
          onEdit={openFriendEditor}
          onDelete={(friend) => removeFriendFromActiveList(friend, 'delete')}
          onArchive={(friend) => removeFriendFromActiveList(friend, 'archive')}
        />

        <ThemedDeleteDialog
          visible={Boolean(pendingFriendDelete)}
          title={`Delete ${pendingFriendDelete?.name ?? 'friend'}?`}
          message="This removes the friend from active split lists while preserving past split records."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          loading={saving}
          onCancel={() => {
            if (!saving) setPendingFriendDelete(null);
          }}
          onConfirm={confirmDeleteFriend}
        />

        <FriendDetailModal
          summary={selectedFriendDetailSummary}
          currentUserName={currentUserName}
          onClose={() => setSelectedFriendDetailId(null)}
          onAddExpense={(friendId) => openBillForFriend(friendId)}
          onSettleUp={(friendId) => openSettlementForFriend(friendId)}
          onOpenGroup={(groupId) => {
            setSelectedFriendDetailId(null);
            setSelectedGroupDetailId(groupId);
          }}
          onOpenOptions={(friend) => setSelectedFriendActions(friend)}
        />

        <GroupDetailModal
          summary={selectedGroupSummary}
          friends={splitFriendCatalog}
          currentUserName={currentUserName}
          onClose={() => setSelectedGroupDetailId(null)}
          onAddExpense={(groupId) => openBillForGroup(groupId)}
          onManageMembers={openMemberPicker}
          onOpenExpense={(bill) => setSelectedBillId(bill.id)}
          onOpenAction={openGroupAction}
          onOpenSettings={(summary) => setGroupSettingsId(summary.group.id)}
        />

        <GroupActionModal
          summary={groupActionSummary}
          mode={groupAction?.mode ?? null}
          friends={splitFriendCatalog}
          currentUserName={currentUserName}
          onClose={() => setGroupAction(null)}
          onSettleWithFriend={openSettlementForGroupFriend}
          onShareExport={(summary) => void shareGroupExport(summary)}
        />

        <BillDetailModal
          bill={selectedBill}
          friends={splitFriendCatalog}
          currentUserName={currentUserName}
          onClose={() => setSelectedBillId(null)}
          onEdit={openBillEditor}
          onDelete={(bill) => setPendingBillDelete(bill)}
        />

        <ThemedDeleteDialog
          visible={Boolean(pendingBillDelete)}
          title={`Delete ${pendingBillDelete?.title ?? 'expense'}?`}
          message="This removes the expense from the split group. Existing friend and group records stay preserved."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          loading={saving}
          onCancel={() => {
            if (!saving) setPendingBillDelete(null);
          }}
          onConfirm={confirmDeleteBill}
        />

        <GroupSettingsModal
          summary={groupSettingsSummary}
          friends={friends}
          currentUserName={currentUserName}
          currentUserContact={currentUserContact}
          simplifyGroupDebts={simplifyGroupDebts}
          defaultSplitLabel={
            groupSettingsSummary
              ? describeGroupDefaultSplit(
                  groupSettingsSummary.group,
                  groupSettingsSummary.group.default_split,
                  (slot) => resolveSlotLabel(groupSettingsSummary.group, slot)
                )
              : ''
          }
          pendingInvites={pendingGroupInvites}
          pendingInvitesLoading={pendingGroupInvitesLoading}
          onToggleSimplifyDebts={() => setSimplifyGroupDebts((current) => !current)}
          onOpenDefaultSplit={openDefaultSplitEditor}
          onClose={() => setGroupSettingsId(null)}
          onAddPeople={openMemberPicker}
          onInvitePerson={openDirectGroupInvite}
          onInviteViaLink={(summary) => void shareGroupInviteLink(summary)}
          onSharePendingInvite={(invite) => void sharePendingGroupInvite(invite)}
          onRevokePendingInvite={setPendingInviteRevoke}
          onEditGroup={openGroupEditor}
          onDeleteGroup={handleDeleteGroup}
          onLeaveGroup={handleLeaveGroup}
        />

        {defaultSplitSummary && defaultSplitDraft ? (
          <GroupDefaultSplitModal
            groupName={defaultSplitSummary.group.name}
            people={defaultSplitPeople}
            draft={defaultSplitDraft}
            screen={defaultSplitScreen}
            saving={saving}
            errorMessage={defaultSplitError}
            hasSavedDefault={Boolean(defaultSplitSummary.group.default_split)}
            onChangeDraft={(next) => {
              setDefaultSplitDraft(next);
              setDefaultSplitError(null);
            }}
            onChangeScreen={setDefaultSplitScreen}
            onSave={() => void saveDefaultSplit()}
            onReset={() => void resetDefaultSplit()}
            onClose={closeDefaultSplitEditor}
          />
        ) : null}

        <ThemedDeleteDialog
          visible={Boolean(pendingGroupLeave)}
          title={`Leave ${pendingGroupLeave?.group.name ?? 'group'}?`}
          message="This removes the group from your split list. The group and existing expenses stay visible to the owner."
          cancelLabel="Cancel"
          confirmLabel="Leave"
          loading={saving}
          onCancel={() => {
            if (!saving) setPendingGroupLeave(null);
          }}
          onConfirm={confirmLeaveGroup}
        />

        <ThemedDeleteDialog
          visible={Boolean(pendingInviteRevoke)}
          title="Revoke invite?"
          message={`This removes the pending invite for ${
            pendingInviteRevoke?.target_email || pendingInviteRevoke?.target_phone || 'this person'
          }. The general group invite link stays active.`}
          cancelLabel="Cancel"
          confirmLabel="Revoke"
          loading={saving}
          onCancel={() => {
            if (!saving) setPendingInviteRevoke(null);
          }}
          onConfirm={confirmRevokeGroupInvite}
        />

        <ThemedDeleteDialog
          visible={Boolean(pendingGroupDelete)}
          title={`Delete ${pendingGroupDelete?.group.name ?? 'group'}?`}
          message="This removes the group from your active split list. Existing split records stay preserved for history."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          loading={saving}
          onCancel={() => {
            if (!saving) setPendingGroupDelete(null);
          }}
          onConfirm={confirmDeleteGroup}
        />

        <GroupMembersModal
          summary={memberPickerSummary}
          friends={friends}
          contacts={deviceContacts}
          contactsPermissionStatus={contactsPermissionStatus}
          contactsAccessPrivileges={contactsAccessPrivileges}
          contactsLoading={contactsLoading}
          searchQuery={memberSearchQuery}
          selectedFriendIds={memberPickerFriendIds}
          saving={saving}
          onChangeSearchQuery={setMemberSearchQuery}
          onToggleFriend={toggleMemberPickerFriend}
          onSelectContact={(contact) => void selectDeviceContact(contact)}
          onRequestContactsAccess={() => void requestContactsAccess()}
          onCreateFriend={openFriendComposerFromMembers}
          onClose={() => closeMemberPicker(true)}
          onSave={() => void handleSaveGroupMembers()}
        />

        <SplitModal
          visible={modal === 'friend'}
          title={editingFriendId ? 'Edit Friend' : 'Add Friend'}
          errorMessage={modal === 'friend' ? error : null}
          footer={
            <PrimaryModalButton
              label={editingFriendId ? 'Update friend' : 'Save friend'}
              loading={saving}
              onPress={() => void handleSaveFriend()}
            />
          }
          onClose={closeModal}>
          <FormInput label="Name" value={friendName} onChangeText={setFriendName} />
          <FormInput
            label="Phone"
            value={friendPhone}
            onChangeText={setFriendPhone}
            keyboardType="phone-pad"
          />
          <FormInput
            label="Email"
            value={friendEmail}
            onChangeText={setFriendEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </SplitModal>

        <SplitModal
          visible={modal === 'group_invite'}
          title="Invite friend"
          errorMessage={modal === 'group_invite' ? error : null}
          footer={
            <PrimaryModalButton
              label="Send invite"
              loading={saving}
              onPress={() => void handleSendGroupInvite()}
            />
          }
          onClose={closeModal}>
          <FormInput
            label="Email"
            value={groupInviteEmail}
            onChangeText={setGroupInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            label="Phone"
            value={groupInvitePhone}
            onChangeText={setGroupInvitePhone}
            keyboardType="phone-pad"
          />
        </SplitModal>

        <CreateGroupModal
          visible={modal === 'group'}
          saving={saving}
          title={editingGroupId ? 'Edit group' : 'Create a group'}
          doneLabel={editingGroupId ? 'Save' : 'Done'}
          groupName={groupName}
          groupKind={groupKind}
          balanceAlertEnabled={groupBalanceAlertEnabled}
          balanceAlertAmount={groupBalanceAlertAmount}
          friends={friends}
          selectedFriendIds={selectedGroupFriendIds}
          onChangeName={setGroupName}
          onChangeKind={setGroupKind}
          onToggleBalanceAlert={() => setGroupBalanceAlertEnabled((current) => !current)}
          onChangeBalanceAlertAmount={setGroupBalanceAlertAmount}
          onToggleFriend={toggleGroupFriend}
          onClose={closeModal}
          onDone={() => void handleCreateGroup()}
        />

        <AddExpenseModal
          visible={modal === 'bill'}
          flowScreen={expenseFlowScreen}
          saving={saving}
          errorMessage={modal === 'bill' ? error : null}
          title={billTitle}
          amount={billAmount}
          date={billDate}
          notes={billNotes}
          groups={groups}
          selectedGroup={selectedBillGroup}
          selectedGroupId={billGroupId}
          isGroupLocked={isBillGroupLocked}
          people={billSplitPeople}
          selection={billSplitSelection}
          onChangeTitle={(value) => {
            setBillTitle(value);
          }}
          onChangeAmount={(value) => {
            setBillAmount(value);
          }}
          onChangeDate={setBillDate}
          onChangeNotes={setBillNotes}
          onSelectGroup={handleSelectBillGroup}
          onChangeFlowScreen={setExpenseFlowScreen}
          onSelectPayer={(payerKey, fullAmount) => {
            setSplitPayerKey(payerKey);
            setSplitFullAmount(fullAmount);
          }}
          onToggleParticipant={(key) => {
            setSplitSelectedKeys((current) =>
              current.includes(key)
                ? current.filter((currentKey) => currentKey !== key)
                : [...current, key]
            );
          }}
          onToggleAllParticipants={() => {
            const allKeys = billSplitPeople.map((person) => person.key);
            const allSelected = allKeys.every((key) => splitSelectedKeys.includes(key));
            setSplitSelectedKeys(allSelected ? [] : allKeys);
          }}
          onChangeAdjustSplitTab={(tab) => {
            setAdjustSplitTab(tab);
            setSplitWeights((current) =>
              Object.keys(current).length > 0 ? current : buildSeedWeights(tab, billSplitSelection)
            );
          }}
          onChangeSplitWeight={(key, value) => {
            setSplitWeights((current) => ({ ...current, [key]: value }));
          }}
          onApplySplit={applySplitChoice}
          onSave={() => void handleCreateBill()}
          onClose={closeModal}
        />

        <SplitModal visible={modal === 'settlement'} title="Record Settlement" onClose={closeModal}>
          <View className="gap-2">
            <TText className="text-xs text-black/60 dark:text-white/60">Friend</TText>
            <View className="flex-row flex-wrap gap-2">
              {friends.map((friend) =>
                renderFriendChip(friend, settlementFriendId, setSettlementFriendId)
              )}
            </View>
          </View>
          <View className="flex-row gap-2">
            <DirectionChip
              label="Friend paid"
              selected={settlementDirection === 'friend_paid_user'}
              onPress={() => setSettlementDirection('friend_paid_user')}
            />
            <DirectionChip
              label="You paid"
              selected={settlementDirection === 'user_paid_friend'}
              onPress={() => setSettlementDirection('user_paid_friend')}
            />
          </View>
          <FormInput
            label="Amount"
            value={settlementAmount}
            onChangeText={setSettlementAmount}
            keyboardType="decimal-pad"
          />
          <FormInput label="Date" value={settlementDate} onChangeText={setSettlementDate} />
          <FormInput
            label="Notes"
            value={settlementNotes}
            onChangeText={setSettlementNotes}
            multiline
          />
          <PrimaryModalButton
            label="Save settlement"
            loading={saving}
            onPress={() => void handleCreateSettlement()}
          />
        </SplitModal>

        <UpgradeSheet
          visible={upgradeSheetVisible}
          entitlement={entitlement}
          onClose={dismissUpgrade}
        />
      </TView>
    </SplitScreenFrame>
  );
}

function SplitScreenFrame({
  embedded,
  backgroundColor,
  children,
}: {
  embedded: boolean;
  backgroundColor: string;
  children: ReactNode;
}) {
  if (embedded) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      {children}
    </SafeAreaView>
  );
}

function SplitTopBar({
  loading,
  activeSection,
  searchVisible,
  onToggleSearch,
  onCreate,
}: {
  loading: boolean;
  activeSection: ActiveSection;
  searchVisible: boolean;
  onToggleSearch: () => void;
  onCreate: () => void;
}) {
  const theme = useThemeTokens().colors;
  const createIcon: keyof typeof MaterialCommunityIcons.glyphMap =
    activeSection === 'friends'
      ? 'account-plus-outline'
      : activeSection === 'activity'
        ? 'account-group-outline'
        : 'account-multiple-plus-outline';
  const createLabel =
    activeSection === 'friends'
      ? 'Add split friend'
      : activeSection === 'activity'
        ? 'Create split group'
        : 'Create split friend or group';
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <TText className="text-2xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
        Split
      </TText>
      <View className="flex-row items-center gap-2">
        {loading ? <ActivityIndicator color={theme.accent} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchVisible ? 'Hide split search' : 'Search splits'}
          onPress={onToggleSearch}
          className="h-11 w-11 items-center justify-center rounded-full">
          <MaterialCommunityIcons
            name={searchVisible ? 'close' : 'magnify'}
            size={26}
            color={theme.text}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createLabel}
          onPress={onCreate}
          className="h-11 w-11 items-center justify-center rounded-full">
          <MaterialCommunityIcons name={createIcon} size={26} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SearchField({
  value,
  onChangeText,
  onClear,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View
      className="mb-5 min-h-12 flex-row items-center gap-3 rounded-2xl px-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
      <MaterialCommunityIcons name="magnify" size={20} color={theme.accent} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search groups, friends, activity"
        placeholderTextColor="rgba(120,120,120,0.7)"
        autoCapitalize="none"
        style={{
          flex: 1,
          color: theme.text,
          fontFamily: Fonts.body,
          minHeight: 46,
        }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear}>
          <MaterialCommunityIcons name="close-circle" size={20} color="rgba(120,120,120,0.8)" />
        </Pressable>
      ) : null}
    </View>
  );
}

function SegmentedSections({
  activeSection,
  onChange,
}: {
  activeSection: ActiveSection;
  onChange: (section: ActiveSection) => void;
}) {
  const theme = useThemeTokens().colors;
  const sections: {
    key: ActiveSection;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }[] = [
    { key: 'groups', label: 'Groups', icon: 'account-group-outline' },
    { key: 'friends', label: 'Friends', icon: 'account-outline' },
    { key: 'activity', label: 'Activity', icon: 'history' },
  ];

  return (
    <View
      className="flex-row rounded-2xl p-1"
      style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
      {sections.map((section) => {
        const selected = activeSection === section.key;
        return (
          <Pressable
            key={section.key}
            accessibilityRole="button"
            onPress={() => onChange(section.key)}
            className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl px-2"
            style={{
              backgroundColor: selected ? theme.secondary : 'transparent',
            }}>
            <MaterialCommunityIcons
              name={section.icon}
              size={17}
              color={selected ? theme.accent : 'rgba(120,120,120,0.9)'}
            />
            <TText
              className="text-xs"
              style={{
                color: selected ? theme.accent : 'rgba(120,120,120,0.95)',
                fontFamily: Fonts.title,
              }}>
              {section.label}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}

function GroupTile({
  variant,
  icon,
}: {
  variant: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const theme = useThemeTokens().colors;
  const variants = [
    { base: theme.accent, top: '#FFB08F', bottom: '#E85318' },
    { base: '#2F80ED', top: '#9CCBFF', bottom: '#174F9A' },
    { base: '#F97316', top: '#FFB366', bottom: '#C2410C' },
    { base: '#C2185B', top: '#EF7AA7', bottom: '#9F1239' },
    { base: '#1FAE8A', top: '#7FE0C8', bottom: '#8B5CF6' },
    { base: '#20BFA3', top: '#F97316', bottom: '#8B5CF6' },
  ];
  const colors = variants[variant % variants.length];

  return (
    <View
      className="h-[86px] w-[86px] overflow-hidden rounded-xl"
      style={{ backgroundColor: colors.base }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 42,
          backgroundColor: colors.top,
          transform: [{ skewY: '28deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -12,
          bottom: -8,
          width: 74,
          height: 54,
          backgroundColor: colors.bottom,
          transform: [{ rotate: '-32deg' }],
        }}
      />
      <View className="flex-1 items-center justify-center">
        <MaterialCommunityIcons name={icon} size={38} color="#FFFFFF" />
      </View>
    </View>
  );
}

function SettledHint({
  settledCount,
  onShowSettled,
}: {
  settledCount: number;
  onShowSettled: () => void;
}) {
  const theme = useThemeTokens().colors;
  if (settledCount <= 0) return null;

  return (
    <View className="items-center px-4 py-5">
      <TText className="text-center text-sm text-black/50 dark:text-white/50">
        Hiding groups that are settled up.
      </TText>
      <Pressable
        accessibilityRole="button"
        onPress={onShowSettled}
        className="mt-4 min-h-12 items-center justify-center rounded-full px-6"
        style={{ borderColor: theme.accent, borderWidth: 1 }}>
        <TText className="text-sm" style={{ color: theme.accent, fontFamily: Fonts.title }}>
          Show {settledCount} settled-up group{settledCount === 1 ? '' : 's'}
        </TText>
      </Pressable>
    </View>
  );
}

function FloatingExpenseButton({ onPress }: { onPress: () => void }) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add split expense"
      onPress={onPress}
      className="absolute bottom-6 right-6 min-h-14 flex-row items-center gap-3 rounded-full px-6"
      style={{
        backgroundColor: theme.accent,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 8,
      }}>
      <MaterialCommunityIcons name="receipt-text-plus-outline" size={22} color="#FFFFFF" />
      <TText className="text-base text-white" style={{ fontFamily: Fonts.title }}>
        Add expense
      </TText>
    </Pressable>
  );
}

function BalanceFilterSheet({
  visible,
  selectedFilter,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedFilter: BalanceFilter;
  onSelect: (filter: BalanceFilter) => void;
  onClose: () => void;
}) {
  const theme = useThemeTokens().colors;
  const options: {
    filter: BalanceFilter;
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }[] = [
    {
      filter: 'open',
      title: 'Open balances',
      description: 'Hide settled groups and friends.',
      icon: 'scale-balance',
    },
    {
      filter: 'owed_to_me',
      title: 'Owed to me',
      description: 'Show only people and groups that owe you.',
      icon: 'arrow-down-bold-circle-outline',
    },
    {
      filter: 'i_owe',
      title: 'I owe',
      description: 'Show only balances you need to pay.',
      icon: 'arrow-up-bold-circle-outline',
    },
    {
      filter: 'settled',
      title: 'Settled up',
      description: 'Show settled groups and friends.',
      icon: 'check-circle-outline',
    },
    {
      filter: 'all',
      title: 'Everything',
      description: 'Show open and settled split records.',
      icon: 'format-list-bulleted',
    },
  ];

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <View
        className="rounded-t-[28px] border px-5 pb-8 pt-5"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="mb-4 flex-row items-center justify-between">
          <TText className="text-lg" style={{ fontFamily: Fonts.title }}>
            Filter balances
          </TText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
        <View className="gap-2">
          {options.map((option) => {
            const selected = selectedFilter === option.filter;
            return (
              <Pressable
                key={option.filter}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.filter)}
                className="flex-row items-center gap-3 rounded-2xl p-3"
                style={{ backgroundColor: selected ? theme.secondary : 'transparent' }}>
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: selected ? theme.accent : theme.secondary }}>
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={19}
                    color={selected ? '#FFFFFF' : theme.accent}
                  />
                </View>
                <View className="flex-1">
                  <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                    {option.title}
                  </TText>
                  <TText className="mt-1 text-xs text-black/55 dark:text-white/55">
                    {option.description}
                  </TText>
                </View>
                {selected ? (
                  <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </AnimatedBottomSheet>
  );
}

function FriendActionsSheet({
  friend,
  onClose,
  onEdit,
  onDelete,
  onArchive,
}: {
  friend: SplitFriend | null;
  onClose: () => void;
  onEdit: (friend: SplitFriend) => void;
  onDelete: (friend: SplitFriend) => void;
  onArchive: (friend: SplitFriend) => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <AnimatedBottomSheet visible={Boolean(friend)} onClose={onClose}>
      <View
        className="rounded-t-[28px] border px-5 pb-8 pt-5"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <TText className="text-lg" style={{ fontFamily: Fonts.title }}>
              {friend?.name ?? 'Friend'}
            </TText>
            <TText className="mt-1 text-xs text-black/55 dark:text-white/55">
              Manage this split friend
            </TText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
        <View className="gap-2">
          <FriendActionRow
            icon="pencil-outline"
            label="Edit friend"
            onPress={() => {
              if (friend) onEdit(friend);
            }}
          />
          <FriendActionRow
            icon="trash-can-outline"
            label="Delete from active list"
            destructive
            onPress={() => {
              if (friend) onDelete(friend);
            }}
          />
          <FriendActionRow
            icon="archive-outline"
            label="Archive friend"
            onPress={() => {
              if (friend) onArchive(friend);
            }}
          />
        </View>
      </View>
    </AnimatedBottomSheet>
  );
}

function FriendActionRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  const color = destructive ? '#DC2626' : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-2xl px-3"
      style={{ backgroundColor: destructive ? '#FEE2E2' : theme.secondary }}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <TText className="text-sm" style={{ color, fontFamily: Fonts.title }}>
        {label}
      </TText>
    </Pressable>
  );
}

function CreateGroupModal({
  visible,
  saving,
  title,
  doneLabel,
  groupName,
  groupKind,
  balanceAlertEnabled,
  balanceAlertAmount,
  friends,
  selectedFriendIds,
  onChangeName,
  onChangeKind,
  onToggleBalanceAlert,
  onChangeBalanceAlertAmount,
  onToggleFriend,
  onClose,
  onDone,
}: {
  visible: boolean;
  saving: boolean;
  title: string;
  doneLabel: string;
  groupName: string;
  groupKind: GroupKind;
  balanceAlertEnabled: boolean;
  balanceAlertAmount: string;
  friends: SplitFriend[];
  selectedFriendIds: number[];
  onChangeName: (value: string) => void;
  onChangeKind: (kind: GroupKind) => void;
  onToggleBalanceAlert: () => void;
  onChangeBalanceAlertAmount: (value: string) => void;
  onToggleFriend: (friendId: number) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useThemeTokens().colors;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        <View
          className="min-h-16 flex-row items-center border-b px-5"
          style={{ borderColor: theme.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close group composer"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="close" size={28} color={theme.text} />
          </Pressable>
          <TText className="flex-1 text-center text-2xl" style={{ fontFamily: Fonts.title }}>
            {title}
          </TText>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onDone}
            className="min-h-11 min-w-11 items-end justify-center">
            {saving ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
                {doneLabel}
              </TText>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 24, paddingBottom: 44 }}>
          <View className="flex-row items-center gap-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose group photo"
              className="h-20 w-20 items-center justify-center rounded-xl border"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={30}
                color="rgba(95,95,95,0.9)"
              />
            </Pressable>
            <View className="flex-1">
              <TText className="text-sm text-black/60 dark:text-white/60">Group name</TText>
              <TextInput
                value={groupName}
                onChangeText={onChangeName}
                autoFocus
                placeholder="Group name"
                placeholderTextColor="rgba(120,120,120,0.7)"
                style={{
                  minHeight: 48,
                  borderBottomWidth: 2,
                  borderColor: groupName ? 'rgba(90,90,90,0.55)' : theme.accent,
                  color: theme.text,
                  fontFamily: Fonts.body,
                  fontSize: 20,
                }}
              />
            </View>
          </View>

          <TText
            className="mt-8 text-base text-black/70 dark:text-white/70"
            style={{ fontFamily: Fonts.title }}>
            Type
          </TText>
          <View className="mt-4 flex-row gap-3">
            {groupKindOptions.map((option) => (
              <GroupTypeCard
                key={option.kind}
                option={option}
                selected={groupKind === option.kind}
                onPress={() => onChangeKind(option.kind)}
              />
            ))}
          </View>

          <View className="mt-9 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <TText className="text-lg" style={{ color: '#7E3FB2', fontFamily: Fonts.title }}>
                Set balance alert
              </TText>
              <MaterialCommunityIcons name="diamond-stone" size={18} color="#8B5CF6" />
            </View>
            <SwitchControl selected={balanceAlertEnabled} onPress={onToggleBalanceAlert} />
          </View>
          <TText className="mt-5 text-base leading-6 text-black/55 dark:text-white/55">
            Finnri can mark this group when someone reaches a balance limit.
          </TText>

          {balanceAlertEnabled ? (
            <View className="mt-8">
              <TText
                className="text-base text-black/70 dark:text-white/70"
                style={{ fontFamily: Fonts.title }}>
                Balance amount
              </TText>
              <View className="mt-3 flex-row items-center gap-5">
                <View
                  className="h-16 w-16 items-center justify-center rounded-lg border"
                  style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  <TText className="text-3xl" style={{ color: theme.text }}>
                    {CURRENCY_SYMBOL}
                  </TText>
                </View>
                <TextInput
                  value={balanceAlertAmount}
                  onChangeText={onChangeBalanceAlertAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="rgba(120,120,120,0.75)"
                  style={{
                    flex: 1,
                    minHeight: 64,
                    borderBottomWidth: 2,
                    borderColor: balanceAlertAmount ? theme.accent : 'rgba(90,90,90,0.55)',
                    color: theme.text,
                    fontFamily: Fonts.title,
                    fontSize: 32,
                  }}
                />
              </View>
            </View>
          ) : null}

          <View className="mt-9">
            <TText
              className="text-base text-black/70 dark:text-white/70"
              style={{ fontFamily: Fonts.title }}>
              Members
            </TText>
            {friends.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {friends.map((friend) => (
                  <MemberToggleChip
                    key={friend.id}
                    friend={friend}
                    selected={selectedFriendIds.includes(friend.id)}
                    onPress={() => onToggleFriend(friend.id)}
                  />
                ))}
              </View>
            ) : (
              <View
                className="mt-3 rounded-2xl border p-4"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                <TText className="text-sm text-black/60 dark:text-white/60">
                  No friends yet. You can add members after creating friends.
                </TText>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function GroupTypeCard({
  option,
  selected,
  onPress,
}: {
  option: (typeof groupKindOptions)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-[118px] flex-1 items-center justify-center gap-3 rounded-2xl border"
      style={{
        backgroundColor: selected ? theme.secondary : theme.card,
        borderColor: selected ? theme.accent : theme.border,
      }}>
      <MaterialCommunityIcons
        name={option.icon}
        size={30}
        color={selected ? theme.accent : 'rgba(82,82,82,0.9)'}
      />
      <TText
        className="text-base"
        style={{ color: selected ? theme.accent : theme.text, fontFamily: Fonts.title }}>
        {option.label}
      </TText>
    </Pressable>
  );
}

function SwitchControl({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="h-8 w-14 justify-center rounded-full px-1"
      style={{ backgroundColor: selected ? '#8B5CF6' : theme.secondary }}>
      <View
        className="h-6 w-6 rounded-full"
        style={{
          backgroundColor: '#FFFFFF',
          alignSelf: selected ? 'flex-end' : 'flex-start',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.16,
          shadowRadius: 4,
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

function FriendDetailModal({
  summary,
  currentUserName,
  onClose,
  onAddExpense,
  onSettleUp,
  onOpenGroup,
  onOpenOptions,
}: {
  summary: FriendDetailSummary | null;
  currentUserName: string;
  onClose: () => void;
  onAddExpense: (friendId: number) => void;
  onSettleUp: (friendId: number) => void;
  onOpenGroup: (groupId: number) => void;
  onOpenOptions: (friend: SplitFriend) => void;
}) {
  const theme = useThemeTokens().colors;
  if (!summary) return null;

  const { friend, groups, netBalance } = summary;
  const friendFirstName = getFirstName(friend.name);
  const unsettledGroup = groups.find((group) =>
    group.bills.some((bill) =>
      bill.participants?.some(
        (participant) => participant.friend_id === friend.id && participant.share_amount > 0
      )
    )
  );
  const balanceCopy =
    netBalance > 0
      ? `${friendFirstName} owes you ${formatBalance(netBalance)}${
          unsettledGroup ? ` in "${unsettledGroup.group.name}"` : ''
        }`
      : netBalance < 0
        ? `You owe ${friendFirstName} ${formatBalance(netBalance)}${
            unsettledGroup ? ` in "${unsettledGroup.group.name}"` : ''
          }`
        : `You and ${friendFirstName} are settled up.`;
  const groupedRows = groups.reduce((acc, group) => {
    const date = group.latestBill?.date ?? group.group.created_at ?? todayApiDate();
    const section = formatMonthYear(date);
    const rows = acc.get(section) ?? [];
    rows.push(group);
    acc.set(section, rows);
    return acc;
  }, new Map<string, SplitGroupSummary[]>());

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="min-h-[250px] overflow-hidden" style={{ backgroundColor: '#1C9A7A' }}>
          <View
            style={{
              position: 'absolute',
              left: -46,
              bottom: 0,
              width: 190,
              height: 118,
              backgroundColor: '#20C0A3',
              transform: [{ rotate: '28deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 128,
              top: 54,
              width: 220,
              height: 152,
              backgroundColor: 'rgba(255,255,255,0.38)',
              transform: [{ rotate: '-32deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: -34,
              bottom: 10,
              width: 260,
              height: 152,
              backgroundColor: 'rgba(255,255,255,0.42)',
              transform: [{ rotate: '32deg' }],
            }}
          />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close friend"
                onPress={onClose}
                className="h-12 w-12 items-center justify-center rounded-full">
                <MaterialCommunityIcons name="arrow-left" size={30} color="#FFFFFF" />
              </Pressable>
              <View className="flex-row gap-4">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search friend activity"
                  className="h-12 w-12 items-center justify-center rounded-full">
                  <MaterialCommunityIcons name="magnify" size={28} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${friend.name} options`}
                  onPress={() => onOpenOptions(friend)}
                  className="h-12 w-12 items-center justify-center rounded-full">
                  <MaterialCommunityIcons name="cog-outline" size={28} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View className="-mt-16 px-8">
          <AvatarCircle label={friend.name} size={112} borderColor="#FFFFFF" />
          <TText className="mt-4 text-4xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
            {friend.name}
          </TText>
          <TText className="mt-6 text-lg leading-7" style={{ color: theme.text }}>
            {balanceCopy}
          </TText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 132, paddingTop: 30 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}>
            <DetailPill
              label="Settle up"
              icon="hand-coin-outline"
              onPress={() => onSettleUp(friend.id)}
            />
            <DetailPill label="Remind..." icon="bell-ring-outline" />
            <DetailPill label="Charts" icon="diamond-stone" />
            <DetailPill label="Convert" icon="diamond-stone" />
          </ScrollView>

          <View className="mt-8">
            {groups.length > 0 ? (
              [...groupedRows.entries()].map(([section, sectionGroups]) => (
                <View key={section} className="mb-7">
                  <TText
                    className="mb-3 text-base text-black/65 dark:text-white/65"
                    style={{ fontFamily: Fonts.title }}>
                    {section}
                  </TText>
                  {sectionGroups.map((group) => (
                    <FriendSharedGroupRow
                      key={group.group.id}
                      summary={group}
                      friendId={friend.id}
                      onPress={() => onOpenGroup(group.group.id)}
                    />
                  ))}
                </View>
              ))
            ) : (
              <View className="items-center px-6 py-16">
                <AvatarCircle label={friend.name} size={70} />
                <TText
                  className="mt-5 text-center text-lg"
                  style={{ color: theme.text, fontFamily: Fonts.title }}>
                  No shared groups yet
                </TText>
                <TText className="mt-2 text-center text-sm leading-5 text-black/55 dark:text-white/55">
                  Add an expense with {friendFirstName} or include them in a group to see history
                  here.
                </TText>
              </View>
            )}
          </View>
        </ScrollView>

        <FloatingExpenseButton onPress={() => onAddExpense(friend.id)} />
      </View>
    </Modal>
  );
}

function FriendSharedGroupRow({
  summary,
  friendId,
  onPress,
}: {
  summary: SplitGroupSummary;
  friendId: number;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  const kindConfig = getGroupKindConfig(summary.kind);
  const date = formatBillListDate(
    summary.latestBill?.date ?? summary.group.created_at ?? todayApiDate()
  );
  const friendNet = summary.bills.reduce((sum, bill) => {
    const participant = bill.participants?.find((item) => item.friend_id === friendId);
    if (!participant) return sum;
    return (
      sum +
      (participant.direction === 'friend_owes_user'
        ? participant.share_amount
        : -participant.share_amount)
    );
  }, 0);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[78px] flex-row items-center gap-4 py-2">
      <View className="w-10 items-center">
        <TText className="text-sm text-black/55 dark:text-white/55">{date.month}</TText>
        <TText className="text-xl text-black/55 dark:text-white/55">{date.day}</TText>
      </View>
      <View
        className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: kindConfig.kind === 'trip' ? '#F97316' : '#8A1238' }}>
        <MaterialCommunityIcons name={kindConfig.icon} size={32} color="#FFFFFF" />
      </View>
      <View className="flex-1">
        <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
          {summary.group.name}
        </TText>
        <TText className="mt-1 text-sm text-black/55 dark:text-white/55">Shared group</TText>
      </View>
      <View className="items-end">
        {friendNet === 0 ? (
          <TText className="text-base text-black/55 dark:text-white/55">settled up</TText>
        ) : (
          <>
            <TText
              className="text-sm"
              style={{ color: friendNet > 0 ? '#12966F' : '#DC2626', fontFamily: Fonts.title }}>
              {friendNet > 0 ? 'you lent' : 'you owe'}
            </TText>
            <TText
              className="mt-1 text-lg"
              style={{ color: friendNet > 0 ? '#12966F' : '#DC2626', fontFamily: Fonts.title }}>
              {formatBalance(friendNet)}
            </TText>
          </>
        )}
      </View>
    </Pressable>
  );
}

function GroupDetailModal({
  summary,
  friends,
  currentUserName,
  onClose,
  onAddExpense,
  onManageMembers,
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
  onOpenExpense: (bill: SplitBill) => void;
  onOpenAction: (summary: SplitGroupSummary, mode: GroupActionMode) => void;
  onOpenSettings: (summary: SplitGroupSummary) => void;
}) {
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
      <View className="flex-1" style={{ backgroundColor: '#FFFFFF' }}>
        <View className="min-h-[270px] overflow-hidden" style={{ backgroundColor: '#155B6D' }}>
          <View
            style={{
              position: 'absolute',
              top: -34,
              left: 82,
              width: 260,
              height: 170,
              backgroundColor: 'rgba(255,255,255,0.08)',
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
              backgroundColor: 'rgba(255,255,255,0.09)',
              transform: [{ rotate: '-18deg' }],
            }}
          />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close group"
                onPress={onClose}
                className="h-12 w-12 items-center justify-center rounded-full bg-white">
                <MaterialCommunityIcons name="arrow-left" size={26} color="#202124" />
              </Pressable>
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search group"
                  onPress={() => {
                    setGroupSearchVisible((current) => !current);
                    if (groupSearchVisible) setGroupSearchQuery('');
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons
                    name={groupSearchVisible ? 'close' : 'magnify'}
                    size={26}
                    color="#202124"
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Group settings"
                  onPress={() => onOpenSettings(summary)}
                  className="h-12 w-12 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons name="cog-outline" size={26} color="#202124" />
                </Pressable>
              </View>
            </View>
            <View className="px-6 pb-8 pt-12">
              <TText className="text-5xl text-white" style={{ fontFamily: Fonts.title }}>
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
                    style={{ borderColor: '#1BB99A', backgroundColor: 'rgba(0,0,0,0.08)' }}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={19}
                      color="#FFFFFF"
                    />
                    <TText className="ml-3 text-base text-white" style={{ fontFamily: Fonts.title }}>
                      Add trip dates
                    </TText>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={!canManageGroup}
                  onPress={() => onManageMembers(summary)}
                  className="min-h-12 flex-row items-center rounded-full px-4"
                  style={{ backgroundColor: 'rgba(39,39,42,0.72)' }}>
                  <MaterialCommunityIcons name="account-group-outline" size={19} color="#FFFFFF" />
                  <TText className="ml-3 text-base text-white" style={{ fontFamily: Fonts.title }}>
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
              style={{ borderColor: 'rgba(15,23,42,0.12)', backgroundColor: '#F8FAFC' }}>
              <MaterialCommunityIcons name="magnify" size={22} color="#6B7280" />
              <TextInput
                value={groupSearchQuery}
                onChangeText={setGroupSearchQuery}
                autoFocus
                autoCapitalize="none"
                placeholder="Search expenses"
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  marginLeft: 10,
                  minHeight: 48,
                  color: '#202124',
                  fontFamily: Fonts.body,
                  fontSize: 16,
                }}
              />
            </View>
          ) : null}

          <View>
            <TText className="text-2xl" style={{ color: '#202124', fontFamily: Fonts.title }}>
              {overallCopy}
            </TText>
            {summary.detailLines.length > 0 ? (
              <View className="mt-3 border-l-4 py-1 pl-5" style={{ borderColor: '#E5E7EB' }}>
                {summary.detailLines.map((line) => (
                  <TText key={line} className="py-1 text-lg leading-7" style={{ color: '#4B5563' }}>
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
                <MaterialCommunityIcons name="magnify" size={34} color="#9CA3AF" />
                <TText
                  className="mt-4 text-center text-lg"
                  style={{ color: '#202124', fontFamily: Fonts.title }}>
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
                  style={{ backgroundColor: '#EAF8F1' }}>
                  <MaterialCommunityIcons
                    name="receipt-text-plus-outline"
                    size={30}
                    color="#17A978"
                  />
                </View>
                <TText
                  className="mt-5 text-center text-lg"
                  style={{ color: '#202124', fontFamily: Fonts.title }}>
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
        <TText className="text-2xl text-black/55">{date.day}</TText>
      </View>
      <View
        className="h-16 w-16 items-center justify-center rounded"
        style={{ backgroundColor: iconConfig.background }}>
        <MaterialCommunityIcons name={iconConfig.icon} size={34} color="#202124" />
      </View>
      <View className="flex-1 pt-1">
        <TText className="text-2xl" style={{ color: '#202124', fontFamily: Fonts.title }}>
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
            style={{ color: net > 0 ? '#12966F' : '#DC2626', fontFamily: Fonts.title }}>
            {net > 0 ? 'you lent' : 'you borrowed'}
          </TText>
          <TText
            className="mt-1 text-base"
            style={{ color: net > 0 ? '#12966F' : '#DC2626', fontFamily: Fonts.title }}>
            {formatBalance(net)}
          </TText>
        </View>
      ) : null}
    </Pressable>
  );
}

function GroupActionModal({
  summary,
  mode,
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
  if (!summary || !mode) return null;

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
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        <View className="min-h-16 flex-row items-center border-b px-5" style={{ borderColor: theme.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={28} color={theme.text} />
          </Pressable>
          <View className="ml-4 flex-1">
            <TText className="text-2xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
              {title}
            </TText>
            <TText className="mt-1 text-xs text-black/50 dark:text-white/50">
              {summary.group.name}
            </TText>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 44 }}>
          {mode === 'settle' ? (
            <View>
              <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
                  <InlineEmptyState
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
              <TText className="mt-8 text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
                Paid by
              </TText>
              <View className="mt-3 gap-2">
                {[...totals.payers.entries()].map(([name, value]) => (
                  <View
                    key={name}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                    style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
                    <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
                      {name}
                    </TText>
                    <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
                      {formatBalance(value)}
                    </TText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'balances' ? (
            <View>
              <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
                    <MaterialCommunityIcons name="table-large" size={25} color="#FFFFFF" />
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
      </SafeAreaView>
    </Modal>
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
  const color = positive ? '#12966F' : negative ? '#DC2626' : theme.text;
  return (
    <View
      className="min-h-16 flex-row items-center gap-4 rounded-2xl border px-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <TText className="flex-1 text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
        {label}
      </TText>
      <TText className="text-base" style={{ color, fontFamily: Fonts.title }}>
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
  const color = balance > 0 ? '#12966F' : balance < 0 ? '#DC2626' : 'rgba(100,100,100,0.8)';
  return (
    <View
      className="rounded-2xl border p-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View className="flex-row items-center gap-4">
        <AvatarCircle label={friend.name} size={46} />
        <View className="flex-1">
          <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
        <TText className="text-base" style={{ color, fontFamily: Fonts.title }}>
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

function getExpenseIconConfig(title: string): {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  background: string;
} {
  const normalized = title.toLowerCase();
  if (/(dinner|lunch|snack|food|restaurant|meal)/.test(normalized)) {
    return { icon: 'silverware-fork-knife', background: '#DFF2E8' };
  }
  if (/(airbnb|hotel|stay|room|rent)/.test(normalized)) {
    return { icon: 'office-building-outline', background: '#F6C6D6' };
  }
  if (/(travel|cab|taxi|train|flight|trip)/.test(normalized)) {
    return { icon: 'car-outline', background: '#DDEBFF' };
  }
  return { icon: 'receipt-text-outline', background: '#FFEDEA' };
}

function BillDetailModal({
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
              <MaterialCommunityIcons name="trash-can-outline" size={27} color="#EF5B5B" />
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
              <TText className="text-3xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                {bill.title}
              </TText>
              <TText
                className="mt-2 text-4xl"
                style={{ color: theme.text, fontFamily: Fonts.title }}>
                {formatBalance(bill.total_amount)}
              </TText>
              <TText className="mt-4 text-base leading-6 text-black/55 dark:text-white/55">
                {bill.date}
                {bill.created_at ? `\nAdded on ${bill.created_at.slice(0, 10)}` : ''}
              </TText>
            </View>
          </View>

          <View className="mt-10">
            <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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

/**
 * How the chosen split reads on the expense screen, so the split screen is
 * something to open when the default is wrong rather than a step to pass
 * through every time.
 */
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

function AddExpenseModal({
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
                      style={{ backgroundColor: '#8A1238' }}>
                      <MaterialCommunityIcons
                        name="receipt-text-outline"
                        size={23}
                        color="#FFFFFF"
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
                    placeholderTextColor="rgba(120,120,120,0.72)"
                    style={{
                      flex: 1,
                      minHeight: 58,
                      borderBottomWidth: 1,
                      borderColor: 'rgba(70,70,70,0.55)',
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
                    <TText className="text-4xl" style={{ color: theme.text }}>
                      {CURRENCY_SYMBOL}
                    </TText>
                  </View>
                  <TextInput
                    value={amount}
                    onChangeText={onChangeAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="rgba(120,120,120,0.72)"
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
                  <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
      <TText
        className="ml-4 flex-1 text-2xl"
        style={{ color: theme.text, fontFamily: Fonts.title }}>
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
          <MaterialCommunityIcons name="calendar-blank-outline" size={30} color="#0E7490" />
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
function SplitChoiceScreen({
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
            <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
  const primaryColor = tone === 'green' ? '#14A986' : '#EA580C';
  return (
    <View className="h-12 w-[82px] flex-row items-center">
      <AvatarCircle label={primaryLabel} size={48} borderColor={primaryColor} />
      <View style={{ marginLeft: -18 }}>
        <AvatarCircle label={secondaryLabel} size={42} borderColor="#FFFFFF" />
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

function AdjustSplitScreen({
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
                    color: selected ? theme.text : 'rgba(90,90,90,0.72)',
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
              <MaterialCommunityIcons name="cash-multiple" size={72} color="#14A986" />
              <MaterialCommunityIcons name="elephant" size={74} color="#2F80ED" />
              <MaterialCommunityIcons name="heart" size={64} color="#DB2777" />
              <MaterialCommunityIcons name="glass-cocktail" size={66} color="#A855F7" />
            </View>
          ) : (
            <MaterialCommunityIcons
              name={activeTab === 'percentages' ? 'percent-outline' : 'scale-balance'}
              size={64}
              color="#14A986"
            />
          )}
          <TText className="mt-7 text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
          <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
            All
          </TText>
          <MaterialCommunityIcons
            name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={30}
            color={allSelected ? theme.accent : 'rgba(120,120,120,0.8)'}
          />
        </Pressable>
      </View>

      <AnimatedBottomSheet visible={payerPickerVisible} onClose={() => setPayerPickerVisible(false)}>
        <View
          className="rounded-t-[28px] border px-5 pb-8 pt-5"
          style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <View className="mb-4 flex-row items-center justify-between">
            <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
        <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
        <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
        color={selected ? theme.accent : 'rgba(120,120,120,0.8)'}
      />
    </Pressable>
  );
}

/**
 * The group's default split, edited on the same two screens the expense
 * composer uses. There is no amount yet, so the rupee previews stand down and
 * the exact-amounts tab is withheld — a default has to be a ratio to survive
 * until the next expense.
 *
 * The people here are the group's real roster, owner first, with "you" landing
 * on whichever slot belongs to the viewer. The stored default names the same
 * people for every member, so it has to be edited in those terms rather than in
 * one member's private frame.
 */
function GroupDefaultSplitModal({
  groupName,
  people,
  draft,
  screen,
  saving,
  errorMessage,
  hasSavedDefault,
  onChangeDraft,
  onChangeScreen,
  onSave,
  onReset,
  onClose,
}: {
  groupName: string;
  people: SplitSlotPerson[];
  draft: SplitSelection;
  screen: 'choice' | 'adjust';
  saving: boolean;
  errorMessage?: string | null;
  hasSavedDefault: boolean;
  onChangeDraft: (next: SplitSelection) => void;
  onChangeScreen: (screen: 'choice' | 'adjust') => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const theme = useThemeTokens().colors;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        {screen === 'choice' ? (
          <View className="flex-1">
            <SplitChoiceScreen
              people={people}
              selection={draft}
              title={`Default split for ${groupName}`}
              onBack={onClose}
              onDone={onSave}
              onSelectPayer={(payerKey, fullAmount) =>
                onChangeDraft({ ...draft, payerKey, fullAmount, tab: 'equally', weights: {} })
              }
              onMoreOptions={() => onChangeScreen('adjust')}
            />
            {errorMessage ? (
              <ErrorBanner message={errorMessage} style={{ marginHorizontal: 24, marginTop: 8 }} />
            ) : null}
            {hasSavedDefault ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onReset}
                className="mb-6 min-h-12 items-center justify-center self-center px-6">
                <TText className="text-base" style={{ color: '#B00034', fontFamily: Fonts.title }}>
                  Remove default split
                </TText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <AdjustSplitScreen
            people={people}
            selection={draft}
            /* A ratio needs some amount to divide; 100 keeps the maths honest
             * while `variant="default"` keeps the rupee figures off screen. */
            amount={100}
            variant="default"
            title="Default split"
            errorMessage={errorMessage}
            onBack={() => onChangeScreen('choice')}
            onDone={onSave}
            onSelectPayer={(payerKey, fullAmount) =>
              onChangeDraft({ ...draft, payerKey, fullAmount })
            }
            onToggleParticipant={(key) =>
              onChangeDraft({
                ...draft,
                participantKeys: draft.participantKeys.includes(key)
                  ? draft.participantKeys.filter((currentKey) => currentKey !== key)
                  : [...draft.participantKeys, key],
              })
            }
            onToggleAll={() => {
              const allKeys = people.map((person) => person.key);
              const allSelected = allKeys.every((key) => draft.participantKeys.includes(key));
              onChangeDraft({ ...draft, participantKeys: allSelected ? [] : allKeys });
            }}
            onChangeTab={(tab) =>
              onChangeDraft({
                ...draft,
                tab,
                weights:
                  Object.keys(draft.weights).length > 0
                    ? draft.weights
                    : buildSeedWeights(tab, { ...draft, tab }),
              })
            }
            onChangeWeight={(key, value) =>
              onChangeDraft({ ...draft, weights: { ...draft.weights, [key]: value } })
            }
          />
        )}
      </SafeAreaView>
    </Modal>
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
          <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
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
          borderColor: selected ? theme.border : 'rgba(120,120,120,0.25)',
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
          placeholderTextColor="rgba(120,120,120,0.7)"
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

function GroupSettingsModal({
  summary,
  friends,
  currentUserName,
  currentUserContact,
  simplifyGroupDebts,
  defaultSplitLabel,
  pendingInvites,
  pendingInvitesLoading,
  onToggleSimplifyDebts,
  onOpenDefaultSplit,
  onClose,
  onAddPeople,
  onInvitePerson,
  onInviteViaLink,
  onSharePendingInvite,
  onRevokePendingInvite,
  onEditGroup,
  onDeleteGroup,
  onLeaveGroup,
}: {
  summary: SplitGroupSummary | null;
  friends: SplitFriend[];
  currentUserName: string;
  currentUserContact: string;
  simplifyGroupDebts: boolean;
  defaultSplitLabel: string;
  pendingInvites: SplitGroupDirectInvite[];
  pendingInvitesLoading: boolean;
  onToggleSimplifyDebts: () => void;
  onOpenDefaultSplit: (summary: SplitGroupSummary) => void;
  onClose: () => void;
  onAddPeople: (summary: SplitGroupSummary) => void;
  onInvitePerson: (summary: SplitGroupSummary) => void;
  onInviteViaLink: (summary: SplitGroupSummary) => void;
  onSharePendingInvite: (invite: SplitGroupDirectInvite) => void;
  onRevokePendingInvite: (invite: SplitGroupDirectInvite) => void;
  onEditGroup: (summary: SplitGroupSummary) => void;
  onDeleteGroup: (summary: SplitGroupSummary) => void;
  onLeaveGroup: (summary: SplitGroupSummary) => void;
}) {
  const theme = useThemeTokens().colors;
  if (!summary) return null;

  const kindConfig = getGroupKindConfig(summary.kind);
  const canManageGroup = summary.group.viewer_can_manage === true;
  const roleLabel = summary.group.viewer_role === 'owner' ? 'Owner' : 'Shared member';
  const memberFriends = summary.memberIds
    .map((memberId) => friends.find((friend) => friend.id === memberId))
    .filter((friend): friend is SplitFriend => Boolean(friend));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        <View
          className="min-h-16 flex-row items-center border-b px-5"
          style={{ borderColor: theme.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close group settings"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={28} color={theme.text} />
          </Pressable>
          <TText
            className="ml-4 flex-1 text-2xl"
            style={{ color: theme.text, fontFamily: Fonts.title }}>
            Group settings
          </TText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 44 }}>
          <View
            className="flex-row items-center gap-5 border-b px-6 py-4"
            style={{ borderColor: theme.border }}>
            <GroupTile variant={kindConfig.variant} icon={kindConfig.icon} />
            <View className="flex-1">
              <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                {summary.group.name}
              </TText>
              <TText className="mt-1 text-base text-black/55 dark:text-white/55">
                {kindConfig.label} • {roleLabel}
              </TText>
            </View>
            {canManageGroup ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit group"
                onPress={() => onEditGroup(summary)}
                className="h-11 w-11 items-center justify-center">
                <MaterialCommunityIcons name="pencil-outline" size={25} color={theme.text} />
              </Pressable>
            ) : null}
          </View>

          <SettingsSectionTitle label="Group members" />
          {canManageGroup ? (
            <>
              <SettingsActionRow
                icon="account-plus-outline"
                label="Add existing friend"
                onPress={() => onAddPeople(summary)}
              />
              <SettingsActionRow
                icon="email-plus-outline"
                label="Invite by email or phone"
                onPress={() => onInvitePerson(summary)}
              />
              <SettingsActionRow
                icon="link-variant"
                label="Invite via link"
                onPress={() => onInviteViaLink(summary)}
              />
            </>
          ) : null}
          <SettingsMemberRow label={`${currentUserName} (you)`} subtitle={currentUserContact} />
          {memberFriends.map((friend) => (
            <SettingsMemberRow
              key={friend.id}
              label={friend.name}
              subtitle={[friend.phone, friend.email].filter(Boolean).join(' • ')}
            />
          ))}

          {canManageGroup && (pendingInvitesLoading || pendingInvites.length > 0) ? (
            <>
              <SettingsSectionTitle label="Pending invites" />
              {pendingInvitesLoading ? (
                <SkeletonFrame
                  label="Loading pending invites"
                  testID="pending-invites-skeleton"
                  style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
                  <SkeletonRows count={2} variant="list" showAmount={false} carded={false} />
                </SkeletonFrame>
              ) : (
                pendingInvites.map((invite) => (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    onShare={() => onSharePendingInvite(invite)}
                    onRevoke={() => onRevokePendingInvite(invite)}
                  />
                ))
              )}
            </>
          ) : null}

          <SettingsSectionTitle label="Advanced settings" />
          <View className="flex-row items-start gap-5 px-6 py-4">
            <MaterialCommunityIcons name="call-split" size={27} color={theme.text} />
            <View className="flex-1">
              <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                Simplify group debts
              </TText>
              <TText className="mt-3 text-base leading-6 text-black/55 dark:text-white/55">
                Automatically combines debts to reduce the total number of repayments between group
                members.{' '}
                <TText style={{ color: theme.accent, fontFamily: Fonts.title }}>Learn more</TText>
              </TText>
            </View>
            <SwitchControl selected={simplifyGroupDebts} onPress={onToggleSimplifyDebts} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set the default split for this group"
            onPress={() => onOpenDefaultSplit(summary)}
            className="flex-row items-start gap-5 px-6 py-4">
            <MaterialCommunityIcons name="format-list-bulleted" size={27} color="#7E3FB2" />
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                  Default split
                </TText>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#E9D5FF' }}>
                  <TText className="text-xs" style={{ color: '#7E22CE', fontFamily: Fonts.title }}>
                    PRO
                  </TText>
                </View>
              </View>
              <TText className="mt-2 text-base text-black/55 dark:text-white/55">
                {defaultSplitLabel}
              </TText>
              <TText className="mt-7 text-base leading-6 text-black/50 dark:text-white/50">
                New expenses in this group start from this split. It belongs to the group, so every
                member sees it and any of them can change it.
              </TText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color={theme.text} />
          </Pressable>
          {!canManageGroup ? (
            <SettingsActionRow
              icon="exit-to-app"
              label="Leave group"
              destructive
              onPress={() => onLeaveGroup(summary)}
            />
          ) : null}
          {canManageGroup ? (
            <SettingsActionRow
              icon="trash-can-outline"
              label="Delete group"
              destructive
              onPress={() => onDeleteGroup(summary)}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AvatarCircle({
  label,
  size,
  borderColor,
}: {
  label: string;
  size: number;
  borderColor?: string;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: theme.secondary,
        borderColor: borderColor ?? theme.background,
        borderWidth: borderColor ? 2 : 0,
      }}>
      <TText
        style={{ color: theme.accent, fontFamily: Fonts.title, fontSize: Math.max(13, size / 3) }}>
        {getInitials(label)}
      </TText>
    </View>
  );
}

function SettingsSectionTitle({ label }: { label: string }) {
  return (
    <TText
      className="px-6 pb-3 pt-6 text-base text-black/70 dark:text-white/70"
      style={{ fontFamily: Fonts.title }}>
      {label}
    </TText>
  );
}

function SettingsActionRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  const color = destructive ? '#B00034' : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[76px] flex-row items-center gap-8 px-8">
      <View className="w-10 items-center">
        <MaterialCommunityIcons name={icon} size={27} color={color} />
      </View>
      <TText className="flex-1 text-xl" style={{ color, fontFamily: Fonts.body }}>
        {label}
      </TText>
    </Pressable>
  );
}

function PendingInviteRow({
  invite,
  onShare,
  onRevoke,
}: {
  invite: SplitGroupDirectInvite;
  onShare: () => void;
  onRevoke: () => void;
}) {
  const theme = useThemeTokens().colors;
  const label = invite.target_email || invite.target_phone || 'Invite';
  const subtitle = [
    invite.matched_user ? 'Finnri user notified' : 'Share link sent manually',
    invite.status,
  ]
    .filter(Boolean)
    .join(' • ');
  return (
    <View className="min-h-[72px] flex-row items-center gap-4 px-6 py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name="email-outline" size={21} color={theme.accent} />
      </View>
      <View className="flex-1">
        <TText
          className="text-base"
          numberOfLines={1}
          style={{ color: theme.text, fontFamily: Fonts.title }}>
          {label}
        </TText>
        <TText className="mt-1 text-xs text-black/50 dark:text-white/50" numberOfLines={1}>
          {subtitle}
        </TText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share invite"
        onPress={onShare}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.card }}>
        <MaterialCommunityIcons name="share-variant-outline" size={21} color={theme.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Revoke invite"
        onPress={onRevoke}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.card }}>
        <MaterialCommunityIcons name="trash-can-outline" size={21} color="#EF5B5B" />
      </Pressable>
    </View>
  );
}

function SettingsMemberRow({ label, subtitle }: { label: string; subtitle?: string }) {
  const theme = useThemeTokens().colors;
  return (
    <View className="min-h-[82px] flex-row items-center gap-5 px-6">
      <AvatarCircle label={label} size={58} />
      <View className="flex-1">
        <TText className="text-lg" style={{ color: theme.text, fontFamily: Fonts.title }}>
          {label}
        </TText>
        {subtitle ? (
          <TText className="mt-1 text-base text-black/55 dark:text-white/55" numberOfLines={1}>
            {subtitle}
          </TText>
        ) : null}
      </View>
    </View>
  );
}

function GroupMembersModal({
  summary,
  friends,
  contacts,
  contactsPermissionStatus,
  contactsAccessPrivileges,
  contactsLoading,
  searchQuery,
  selectedFriendIds,
  saving,
  onChangeSearchQuery,
  onToggleFriend,
  onSelectContact,
  onRequestContactsAccess,
  onCreateFriend,
  onClose,
  onSave,
}: {
  summary: SplitGroupSummary | null;
  friends: SplitFriend[];
  contacts: DeviceContactOption[];
  contactsPermissionStatus: Contacts.PermissionStatus | null;
  contactsAccessPrivileges: Contacts.ContactsPermissionResponse['accessPrivileges'] | null;
  contactsLoading: boolean;
  searchQuery: string;
  selectedFriendIds: number[];
  saving: boolean;
  onChangeSearchQuery: (value: string) => void;
  onToggleFriend: (friendId: number) => void;
  onSelectContact: (contact: DeviceContactOption) => void;
  onRequestContactsAccess: () => void;
  onCreateFriend: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const theme = useThemeTokens().colors;
  if (!summary) return null;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const contactAccessGranted = contactsPermissionStatus === Contacts.PermissionStatus.GRANTED;
  const filteredContacts = contacts.filter((contact) =>
    [contact.name, contact.phone, contact.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );
  const filteredFriends = friends.filter((friend) =>
    [friend.name, friend.phone, friend.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        <View className="min-h-16 flex-row items-center px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close group members"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={26} color={theme.text} />
          </Pressable>
          <TextInput
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
            autoFocus
            autoCapitalize="none"
            placeholder="Enter name, email, or phone #"
            placeholderTextColor="rgba(120,120,120,0.75)"
            style={{
              flex: 1,
              minHeight: 52,
              color: theme.text,
              fontFamily: Fonts.body,
              fontSize: 20,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onSave}
            className="min-h-11 min-w-12 items-end justify-center">
            {saving ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <TText className="text-base" style={{ color: theme.text, fontFamily: Fonts.title }}>
                Save
              </TText>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 44 }}>
          <Pressable
            accessibilityRole="button"
            onPress={onCreateFriend}
            className="min-h-16 flex-row items-center gap-8 py-2">
            <View className="w-12 items-center">
              <MaterialCommunityIcons name="account-plus-outline" size={28} color={theme.text} />
            </View>
            <TText className="flex-1 text-xl" style={{ color: theme.text, fontFamily: Fonts.body }}>
              {searchQuery.trim() ? `Add "${searchQuery.trim()}" as new friend` : 'Add someone new'}
            </TText>
          </Pressable>

          <TText
            className="mt-5 text-base text-black/70 dark:text-white/70"
            style={{ fontFamily: Fonts.title }}>
            From your contacts
          </TText>

          {!contactAccessGranted ? (
            <ContactsPermissionPrompt
              loading={contactsLoading}
              denied={contactsPermissionStatus === Contacts.PermissionStatus.DENIED}
              onRequest={onRequestContactsAccess}
            />
          ) : contactsLoading ? (
            <SkeletonFrame label="Loading contacts" testID="contacts-skeleton">
              <SkeletonRows count={5} variant="list" showAmount={false} carded={false} />
            </SkeletonFrame>
          ) : filteredContacts.length > 0 ? (
            <View className="mt-3">
              {contactsAccessPrivileges === 'limited' ? (
                <TText className="mb-2 text-xs text-black/50 dark:text-white/50">
                  Showing contacts you allowed Finnri to access.
                </TText>
              ) : null}
              {filteredContacts.map((contact) => {
                const matchedFriend = friends.find((friend) =>
                  contactMatchesFriend(contact, friend)
                );
                const selected = Boolean(
                  matchedFriend && selectedFriendIds.includes(matchedFriend.id)
                );
                return (
                  <MemberDirectoryRow
                    key={contact.id}
                    title={contact.name}
                    subtitle={[contact.phone, contact.email].filter(Boolean).join(', ')}
                    imageUri={contact.imageUri}
                    selected={selected}
                    onPress={() => onSelectContact(contact)}
                  />
                );
              })}
            </View>
          ) : (
            <TText className="mt-6 text-sm text-black/55 dark:text-white/55">
              {normalizedSearch ? 'No matching contacts.' : 'No contacts available.'}
            </TText>
          )}

          <TText
            className="mt-8 text-base text-black/70 dark:text-white/70"
            style={{ fontFamily: Fonts.title }}>
            Friends on Finnri
          </TText>
          {filteredFriends.length > 0 ? (
            <View className="mt-3">
              {filteredFriends.map((friend) => (
                <MemberDirectoryRow
                  key={friend.id}
                  title={friend.name}
                  subtitle={[friend.phone, friend.email].filter(Boolean).join(', ')}
                  selected={selectedFriendIds.includes(friend.id)}
                  onPress={() => onToggleFriend(friend.id)}
                />
              ))}
            </View>
          ) : (
            <TText className="mt-6 text-sm text-black/55 dark:text-white/55">
              {normalizedSearch ? 'No matching Finnri friends.' : 'No Finnri friends yet.'}
            </TText>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ContactsPermissionPrompt({
  loading,
  denied,
  onRequest,
}: {
  loading: boolean;
  denied: boolean;
  onRequest: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="items-center px-4 py-12">
      <View
        className="h-36 w-36 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name="contacts-outline" size={72} color={theme.accent} />
      </View>
      <TText className="mt-8 text-center text-lg leading-7 text-black/60 dark:text-white/60">
        Allow Finnri to access your contacts to add people faster.
      </TText>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={onRequest}
        className="mt-8 min-h-12 min-w-[230px] items-center justify-center rounded"
        style={{ backgroundColor: theme.accent, opacity: loading ? 0.75 : 1 }}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <TText className="text-base text-white" style={{ fontFamily: Fonts.title }}>
            {denied ? 'Request contact access' : 'Allow contact access'}
          </TText>
        )}
      </Pressable>
    </View>
  );
}

function MemberDirectoryRow({
  title,
  subtitle,
  imageUri,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  imageUri?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="min-h-[76px] flex-row items-center gap-8 py-2">
      <View className="w-12 items-center">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="h-12 w-12 rounded-full" />
        ) : (
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: selected ? theme.accent : theme.secondary }}>
            <MaterialCommunityIcons
              name={subtitle ? 'phone-outline' : 'account-outline'}
              size={22}
              color={selected ? '#FFFFFF' : theme.text}
            />
          </View>
        )}
      </View>
      <View className="flex-1">
        <TText
          className="text-xl"
          numberOfLines={1}
          style={{ color: theme.text, fontFamily: Fonts.body }}>
          {title}
        </TText>
        {subtitle ? (
          <TText className="mt-1 text-sm text-black/50 dark:text-white/50" numberOfLines={1}>
            {subtitle}
          </TText>
        ) : null}
      </View>
      {selected ? (
        <MaterialCommunityIcons name="check-circle" size={22} color={theme.accent} />
      ) : null}
    </Pressable>
  );
}

function DetailPill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-2 rounded-full border px-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.accent} />
      <TText className="text-sm" style={{ color: theme.text, fontFamily: Fonts.title }}>
        {label}
      </TText>
    </Pressable>
  );
}

function InlineEmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View
      className="items-center rounded-2xl border p-5"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.accent} />
      </View>
      <TText className="mt-3 text-sm text-center" style={{ fontFamily: Fonts.title }}>
        {title}
      </TText>
      <TText className="mt-1 text-xs text-center text-black/60 dark:text-white/60">{message}</TText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="mt-4 min-h-10 items-center justify-center rounded-2xl px-4"
          style={{ backgroundColor: theme.accent }}>
          <TText className="text-xs text-white" style={{ fontFamily: Fonts.title }}>
            {actionLabel}
          </TText>
        </Pressable>
      ) : null}
    </View>
  );
}

function MemberToggleChip({
  friend,
  selected,
  onPress,
}: {
  friend: SplitFriend;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-2xl px-3 py-2"
      style={{
        backgroundColor: selected ? theme.accent : theme.background,
        borderColor: selected ? theme.accent : theme.border,
        borderWidth: 1,
      }}>
      <MaterialCommunityIcons
        name={selected ? 'check-circle' : 'plus-circle-outline'}
        size={16}
        color={selected ? '#FFFFFF' : theme.accent}
      />
      <TText
        className="text-xs"
        style={{ color: selected ? '#FFFFFF' : theme.text, fontFamily: Fonts.title }}>
        {friend.name}
      </TText>
    </Pressable>
  );
}

function GroupChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-2xl px-3 py-2"
      style={{
        backgroundColor: selected ? theme.accent : theme.background,
        borderColor: selected ? theme.accent : theme.border,
        borderWidth: 1,
      }}>
      <TText
        className="text-xs"
        style={{ color: selected ? '#FFFFFF' : theme.text, fontFamily: Fonts.title }}>
        {label}
      </TText>
    </Pressable>
  );
}

function SplitModal({
  visible,
  title,
  errorMessage,
  footer,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  errorMessage?: string | null;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useThemeTokens().colors;
  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose} avoidKeyboard>
      <View
        className="max-h-[88%] rounded-t-[28px] border px-5 pb-8 pt-5"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="mb-4 flex-row items-center justify-between">
          <TText className="text-lg" style={{ fontFamily: Fonts.title }}>
            {title}
          </TText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
        {errorMessage ? (
          <ErrorBanner message={errorMessage} style={{ marginBottom: 12 }} />
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: footer ? 12 : 0 }}>
          {children}
        </ScrollView>
        {footer ? (
          <View className="border-t pt-4" style={{ borderColor: theme.border }}>
            {footer}
          </View>
        ) : null}
      </View>
    </AnimatedBottomSheet>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="gap-2">
      <TText className="text-xs text-black/60 dark:text-white/60">{label}</TText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        placeholderTextColor="rgba(120,120,120,0.7)"
        style={{
          minHeight: multiline ? 84 : 48,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
          color: theme.text,
          fontFamily: Fonts.body,
          backgroundColor: theme.background,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function DirectionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 rounded-2xl px-3 py-3"
      style={{
        backgroundColor: selected ? theme.accent : 'transparent',
        borderColor: selected ? 'transparent' : theme.border,
        borderWidth: 1,
      }}>
      <TText
        className="text-center text-xs"
        style={{ color: selected ? '#FFFFFF' : theme.text, fontFamily: Fonts.title }}>
        {label}
      </TText>
    </Pressable>
  );
}

function PrimaryModalButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      className="mt-2 min-h-12 items-center justify-center rounded-2xl"
      style={{ backgroundColor: theme.accent, opacity: loading ? 0.75 : 1 }}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <TText className="text-sm text-white" style={{ fontFamily: Fonts.title }}>
          {label}
        </TText>
      )}
    </Pressable>
  );
}

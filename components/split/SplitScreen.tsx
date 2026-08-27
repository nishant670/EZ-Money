import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter, useScrollToTop } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { UpgradeSheet } from '@/components/billing/UpgradeSheet';
import { AppHeader } from '@/components/navigation/AppHeader';
import {
  AddExpenseModal,
  type ExpenseFlowScreen,
} from '@/components/split/expense/AddExpenseModal';
import { CreateGroupModal } from '@/components/split/modals/CreateGroupModal';
import {
  SearchField,
  SegmentedSections,
  SettledHint,
  SplitScreenFrame,
  type ActiveSection,
} from '@/components/split/primitives/SplitChrome';
import { FriendDetailModal } from '@/components/split/modals/FriendDetailModal';
import { GroupDetailModal } from '@/components/split/modals/GroupDetailModal';
import { GroupDefaultSplitModal } from '@/components/split/modals/GroupDefaultSplitModal';
import { GroupSettingsModal } from '@/components/split/modals/GroupSettingsModal';
import { GroupMembersModal } from '@/components/split/modals/GroupMembersModal';
import { GroupTile } from '@/components/split/rows/GroupTile';
import { SwipeActionRow } from '@/components/split/rows/SwipeActionRow';
import { GroupActionModal } from '@/components/split/modals/GroupActionModal';
import { BillDetailModal } from '@/components/split/modals/BillDetailModal';
import {
  AvatarCircle,
  DirectionChip,
  FloatingExpenseButton,
  FormInput,
  PrimaryModalButton,
  SplitModal,
} from '@/components/split/primitives/SplitPrimitives';
import {
  contactMatchesFriend,
  countHiddenSettledGroups,
  formatBalance,
  getGroupKindConfig,
  getGroupBalanceRows,
  groupMatchesSearch,
  parseAmount,
  todayApiDate,
} from '@/components/split/split-utils';
import type {
  DeviceContactOption,
  FriendDetailSummary,
  GroupActionMode,
  SplitGroupSummary,
} from '@/components/split/split-types';
import type { Category } from '@/lib/categories';
import { haptics } from '@/lib/haptics';
import {
  BalanceFilterSheet,
  type BalanceFilter,
} from '@/components/split/sheets/BalanceFilterSheet';
import { DeleteGroupSheet } from '@/components/split/sheets/DeleteGroupSheet';
import { notifyTransactionsChanged } from '@/lib/transaction-events';
import { FriendActionsSheet } from '@/components/split/sheets/FriendActionsSheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { CountUpMoney } from '@/components/ui/CountUpMoney';
import { SkeletonFrame, SkeletonRows } from '@/components/ui/Skeleton';
import { StateView } from '@/components/ui/StateView';
import { ThemedConfirmDialog, ThemedDeleteDialog } from '@/components/ui/ThemedConfirmDialog';
import { Card } from '@/components/ui/theme-primitives';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useEntitlementGate } from '@/hooks/use-entitlement-gate';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useMotion } from '@/hooks/use-motion';
import { fetchAccounts, getPreferredAccountForPaymentMode } from '@/lib/accounts';
import { userDisplayName } from '@/lib/display-name';
import { createEntry } from '@/lib/entries';
import { toAmountString } from '@/lib/money';
import {
  buildSeedWeights,
  computeSplitShares,
  CURRENT_USER_KEY,
  defaultSplitToComposerKeys,
  defaultSplitToSelection,
  describeGroupDefaultSplit,
  describeMemberInvites,
  friendSplitKey,
  groupSplitSlots,
  isDefaultSplitTab,
  selectionToDefaultSplit,
  splitParticipantKeys,
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
  type SplitGroupEntryDisposition,
  type SplitGroupDirectInvite,
  type SplitGroupMemberInvite,
} from '@/lib/splits';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type ModalKind = 'friend' | 'group' | 'bill' | 'settlement' | 'group_invite' | null;
type ParticipantDraft = {
  friend_id: number;
  share_amount: number;
  direction: SplitDirection;
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

const getBalanceTone = (
  value: number,
  colors: { positive: string; negative: string; neutral: string }
) => {
  if (value > 0) return { label: `you are owed ${formatBalance(value)}`, color: colors.positive };
  if (value < 0) return { label: `you owe ${formatBalance(value)}`, color: colors.negative };
  return { label: 'settled up', color: colors.neutral };
};

function BalanceFigure({
  value,
  color,
  overall = false,
}: {
  value: number;
  color: string;
  overall?: boolean;
}) {
  const variant = overall ? 'sectionTitle' : 'cardTitle';
  if (value === 0) {
    return (
      <TText variant={variant} style={{ color }}>
        {overall ? 'Overall, settled up' : 'settled up'}
      </TText>
    );
  }
  const relationship = value > 0 ? 'you are owed' : 'you owe';
  return (
    <View className="flex-row flex-wrap items-baseline">
      <TText variant={variant} style={{ color }}>
        {overall ? `Overall, ${relationship} ` : `${relationship} `}
      </TText>
      <CountUpMoney
        variant={variant}
        amount={Math.abs(value)}
        sign="never"
        style={{ color }}
      />
    </View>
  );
}

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
  const motion = useMotion();
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
  const [openSwipeRow, setOpenSwipeRow] = useState<string | null>(null);
  const [selectedGroupDetailId, setSelectedGroupDetailId] = useState<number | null>(null);
  const [groupSettingsId, setGroupSettingsId] = useState<number | null>(null);
  const [groupAction, setGroupAction] = useState<{
    groupId: number;
    mode: GroupActionMode;
  } | null>(null);
  const [pendingGroupDelete, setPendingGroupDelete] = useState<SplitGroupSummary | null>(null);
  /**
   * Reset to `keep` every time the sheet opens — see `DeleteGroupSheet`. A
   * choice that persists across two different groups is a choice the user did
   * not make about the second one, and one of the two answers is destructive.
   */
  const [groupDeleteDisposition, setGroupDeleteDisposition] =
    useState<SplitGroupEntryDisposition>('keep');
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
  const [soloGroupPromptId, setSoloGroupPromptId] = useState<number | null>(null);
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
  const overallTone = getBalanceTone(overallNetBalance, theme);

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

  const soloGroupPromptSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === soloGroupPromptId) ?? null,
    [groupSummaries, soloGroupPromptId]
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

  useEffect(() => {
    setOpenSwipeRow(null);
  }, [activeSection, balanceFilter, normalizedSearch]);

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
      const matchesSearch = groupMatchesSearch(summary, normalizedSearch, friendById);
      const isNewEmptyGroup = summary.billCount === 0 && summary.netBalance === 0;
      const matchesBalance =
        balanceFilter === 'open' && isNewEmptyGroup
          ? true
          : balanceMatchesFilter(summary.netBalance);
      return matchesSearch && matchesBalance;
    });
  }, [balanceFilter, balanceMatchesFilter, friendById, groupSummaries, normalizedSearch]);

  const hiddenSettledCount = useMemo(
    () =>
      countHiddenSettledGroups(groupSummaries, visibleGroupSummaries, (summary) =>
        groupMatchesSearch(summary, normalizedSearch, friendById)
      ),
    [friendById, groupSummaries, normalizedSearch, visibleGroupSummaries]
  );

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
      haptics.saved();
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
      haptics.saved();
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
            .then(async () => {
              haptics.removed();
              await loadSplitData();
            })
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
      .then(async () => {
        haptics.removed();
        await loadSplitData();
      })
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

  /**
   * Swiping a group and deleting it from its settings are the same operation,
   * so they now open the same sheet.
   *
   * They were two flows with two vocabularies over one endpoint: a system alert
   * saying "Archive" and promising the history was preserved, and a themed
   * dialog saying "Delete". Both called the same handler, and neither described
   * what it actually did to the balances.
   */
  const handleArchiveGroup = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    setOpenSwipeRow(null);
    openGroupDeletePrompt(summary);
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
    participants: ParticipantDraft[],
    category: Category
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
        category,
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

  const handleCreateBill = async (category: Category) => {
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
        await createEntryBackedSplitBill(token, amount, finalParticipants, category);
      }
      haptics.saved();
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
      haptics.saved();
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
      haptics.saved();
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

  const openGroupDeletePrompt = (summary: SplitGroupSummary) => {
    setError(null);
    // Keeping is the answer every time the sheet opens: it is the recoverable
    // one, and the other destroys transactions.
    setGroupDeleteDisposition('keep');
    setPendingGroupDelete(summary);
  };

  const handleDeleteGroup = (summary: SplitGroupSummary) => {
    if (!summary.group.viewer_can_manage) return;
    openGroupDeletePrompt(summary);
  };

  const handleLeaveGroup = (summary: SplitGroupSummary) => {
    if (summary.group.viewer_can_manage) return;
    setPendingGroupLeave(summary);
  };

  const confirmDeleteGroup = () => {
    if (!token || !pendingGroupDelete || saving) return;
    const removedGroupId = pendingGroupDelete.group.id;
    const disposition = groupDeleteDisposition;
    setSaving(true);
    setError(null);
    void archiveSplitGroup(token, removedGroupId, disposition)
      .then(async (result) => {
        haptics.removed();
        setPendingGroupDelete(null);
        setGroupSettingsId(null);
        setSelectedGroupDetailId(null);
        await loadSplitData();
        // The transaction feed on Home is reading the same rows this just
        // removed, so it has to be told rather than left to notice.
        if (result.deleted_entries > 0) notifyTransactionsChanged();
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

  const startBillForGroup = (groupId: number) => {
    resetBillForm();
    handleSelectBillGroup(groupId);
    setIsBillGroupLocked(true);
    setSelectedGroupDetailId(null);
    setModal('bill');
  };

  const openBillForGroup = (groupId: number) => {
    const group = groups.find((candidate) => candidate.id === groupId) ?? null;
    const groupHasMembers = Boolean(
      group?.members?.some((member) => friendById.has(member.friend_id))
    );
    /**
     * An expense in a group of one is a valid thing to record, and sometimes
     * exactly what somebody means to do. But far more often it means they have
     * not finished making the group — so it is worth asking once, with adding
     * people offered rather than demanded.
     */
    if (!groupHasMembers && group?.viewer_can_manage) {
      setSoloGroupPromptId(groupId);
      return;
    }
    if (!groupHasMembers && friends.length === 0) {
      setSelectedGroupDetailId(null);
      openModal('friend');
      return;
    }
    startBillForGroup(groupId);
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
        onPress={() => {
          haptics.select();
          onSelect(friend.id);
        }}
        className="rounded-2xl px-3 py-2"
        style={{
          borderWidth: 1,
          borderColor: isSelected ? theme.accent : borderColor,
          backgroundColor: isSelected ? theme.accent : 'transparent',
        }}>
        <TText
          className="text-xs"
          style={{ color: isSelected ? theme.onAccent : theme.text, fontFamily: Fonts.title }}>
          {friend.name}
        </TText>
      </Pressable>
    );
  };

  const renderFriendRow = (friend: SplitFriend, entranceIndex: number) => {
    const balance = balanceByFriendId.get(friend.id);
    const netBalance = balance?.net_balance ?? 0;
    const isReceivable = netBalance > 0;
    const isPayable = netBalance < 0;
    const amountColor = isReceivable
      ? theme.positive
      : isPayable
        ? theme.negative
        : theme.neutral;
    const balanceLabel = isReceivable ? 'owes you' : isPayable ? 'you owe' : 'settled';

    return (
      <Animated.View
        key={friend.id}
        entering={motion.rowEntering(entranceIndex)}
        layout={motion.reflow()}>
        <SwipeActionRow
          open={openSwipeRow === `friend-${friend.id}`}
          onOpenChange={(open) => setOpenSwipeRow(open ? `friend-${friend.id}` : null)}
          actions={[
            {
              label: 'Edit',
              icon: 'pencil-outline',
              onPress: () => openFriendEditor(friend),
            },
            {
              label: 'Archive',
              icon: 'archive-outline',
              tone: 'destructive',
              onPress: () => handleArchiveFriend(friend),
            },
          ]}>
          <Card compact style={{ padding: 0 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${friend.name}`}
              onPress={() => openFriendDetail(friend.id)}
              onLongPress={() => setSelectedFriendActions(friend)}
              className="flex-row items-center gap-4 p-4">
              <AvatarCircle label={friend.name} size={58} />
              <View className="flex-1">
                <TText variant="cardTitle" style={{ color: theme.text }}>
                  {friend.name}
                </TText>
                <TText className="mt-1 text-xs" style={{ color: theme.muted }}>
                  {[friend.phone, friend.email].filter(Boolean).join(' • ') || 'No contact saved'}
                </TText>
                <TText
                  className="mt-1 text-sm"
                  style={{ color: amountColor, fontFamily: Fonts.title }}>
                  {formatBalance(netBalance)} {balanceLabel}
                </TText>
              </View>
            </Pressable>
          </Card>
        </SwipeActionRow>
      </Animated.View>
    );
  };

  const renderGroupCard = (summary: SplitGroupSummary, entranceIndex: number) => {
    const { group, detailLines, memberIds, kind, netBalance, billCount, latestBill } = summary;
    const tone = getBalanceTone(netBalance, theme);
    const kindConfig = getGroupKindConfig(kind);
    const memberNames = memberIds
      .map((memberId) => friendById.get(memberId)?.name)
      .filter(Boolean)
      .join(', ');

    return (
      <Animated.View
        key={group.id}
        entering={motion.rowEntering(entranceIndex)}
        layout={motion.reflow()}>
        <SwipeActionRow
          open={openSwipeRow === `group-${group.id}`}
          onOpenChange={(open) => setOpenSwipeRow(open ? `group-${group.id}` : null)}
          actions={
            group.viewer_can_manage
              ? [
                  {
                    label: 'Edit',
                    icon: 'pencil-outline' as const,
                    onPress: () => openGroupEditor(summary),
                  },
                  {
                    label: 'Archive',
                    icon: 'archive-outline' as const,
                    tone: 'destructive' as const,
                    onPress: () => handleArchiveGroup(summary),
                  },
                ]
              : []
          }>
          <Card compact style={{ padding: 0 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedGroupDetailId(group.id)}
              className="flex-row gap-4 p-4">
              <GroupTile icon={kindConfig.icon} />
              <View className="flex-1 justify-center">
                <TText variant="cardTitle" style={{ color: theme.text }}>
                  {group.name}
                </TText>
                <View className="mt-1">
                  <BalanceFigure value={netBalance} color={tone.color} />
                </View>
                {detailLines.length > 0 ? (
                  detailLines.map((line) => (
                    <TText
                      key={line}
                      className="mt-1 text-sm" style={{ color: theme.muted }}
                      numberOfLines={1}>
                      {line}
                    </TText>
                  ))
                ) : (
                  <TText
                    className="mt-1 text-sm" style={{ color: theme.muted }}
                    numberOfLines={1}>
                    {latestBill
                      ? `${billCount} bill${billCount === 1 ? '' : 's'} • last on ${latestBill.date}`
                      : memberNames || 'No expenses yet'}
                  </TText>
                )}
              </View>
            </Pressable>
          </Card>
        </SwipeActionRow>
      </Animated.View>
    );
  };

  const renderNonGroupRow = (entranceIndex: number) => {
    const tone = getBalanceTone(nonGroupSummary.netBalance, theme);
    return (
      <Animated.View entering={motion.rowEntering(entranceIndex)} layout={motion.reflow()}>
        <Card compact style={{ padding: 0 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => openModal('bill')}
            className="flex-row gap-4 p-4">
          <GroupTile icon="receipt-text-outline" />
          <View className="flex-1 justify-center">
          <TText variant="cardTitle" style={{ color: theme.text }}>
            Non-group expenses
          </TText>
          <View className="mt-1">
            <BalanceFigure value={nonGroupSummary.netBalance} color={tone.color} />
          </View>
          {nonGroupSummary.detailLines.length > 0 ? (
            nonGroupSummary.detailLines.map((line) => (
              <TText
                key={line}
                className="mt-1 text-sm" style={{ color: theme.muted }}
                numberOfLines={1}>
                {line}
              </TText>
            ))
          ) : (
            <TText className="mt-1 text-sm" style={{ color: theme.muted }} numberOfLines={1}>
              {nonGroupSummary.latestBill
                ? `${nonGroupSummary.billCount} bill${
                    nonGroupSummary.billCount === 1 ? '' : 's'
                  } • last on ${nonGroupSummary.latestBill.date}`
                : 'Personal shared expenses'}
            </TText>
          )}
          </View>
          </Pressable>
        </Card>
      </Animated.View>
    );
  };

  const renderActivityRow = (item: (typeof recentActivity)[number], entranceIndex: number) => (
    <Animated.View
      key={item.id}
      entering={motion.rowEntering(entranceIndex)}
      layout={motion.reflow()}>
      <Card compact style={{ padding: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open activity ${item.title}`}
        onPress={() => openActivityTarget(item.item)}
        className="flex-row items-center gap-4 p-4">
      <View
        className="h-[58px] w-[58px] items-center justify-center rounded-xl"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name={item.icon} size={26} color={theme.accent} />
      </View>
      <View className="flex-1">
        <TText variant="cardTitle" style={{ color: theme.text }}>
          {item.title}
        </TText>
        <TText className="mt-1 text-xs" style={{ color: theme.muted }}>
          {item.caption} • {item.date}
        </TText>
      </View>
      {item.amount != null ? (
        <TText className="text-sm" style={{ color: theme.text, fontFamily: Fonts.title }}>
          {formatBalance(item.amount)}
        </TText>
      ) : null}
      </Pressable>
      </Card>
    </Animated.View>
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
            <AppHeader
              title="Split"
              style={{ marginBottom: 20, paddingHorizontal: 0, paddingVertical: 0 }}
              rightNode={
                <View className="ml-4 flex-row items-center gap-2">
                  {loading ? <ActivityIndicator color={theme.accent} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={searchVisible ? 'Hide split search' : 'Search splits'}
                    onPress={() => setSearchVisible((current) => !current)}
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.card }}>
                    <MaterialCommunityIcons
                      name={searchVisible ? 'close' : 'magnify'}
                      size={22}
                      color={theme.accent}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      activeSection === 'friends'
                        ? 'Add split friend'
                        : activeSection === 'activity'
                          ? 'Create split group'
                          : 'Create split friend or group'
                    }
                    onPress={openContextCreate}
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.card }}>
                    <MaterialCommunityIcons
                      name={
                        activeSection === 'friends'
                          ? 'account-plus-outline'
                          : activeSection === 'activity'
                            ? 'account-group-outline'
                            : 'account-multiple-plus-outline'
                      }
                      size={22}
                      color={theme.accent}
                    />
                  </Pressable>
                </View>
              }
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
              <StateView
                compact
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
                  <BalanceFigure
                    value={overallNetBalance}
                    color={overallTone.color}
                    overall
                  />
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
                    {showNonGroupSummary
                      ? renderNonGroupRow(visibleGroupSummaries.length)
                      : null}
                    <SettledHint
                      settledCount={hiddenSettledCount}
                      onShowSettled={() => {
                        setBalanceFilter('settled');
                        setFilterSheetVisible(false);
                      }}
                    />

                  </>
                ) : (
                  <StateView
                    compact
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
                  <StateView
                    compact
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
                  <TText variant="sectionTitle" style={{ color: theme.text }}>
                    Recent activity
                  </TText>
                </View>
                {visibleActivity.length > 0 ? (
                  visibleActivity.map(renderActivityRow)
                ) : (
                  <StateView
                    compact
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
          onInviteViaLink={(summary) => void shareGroupInviteLink(summary)}
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

        <GroupDefaultSplitModal
          visible={Boolean(defaultSplitSummary && defaultSplitDraft)}
          groupName={defaultSplitSummary?.group.name ?? null}
          people={defaultSplitPeople}
          draft={defaultSplitDraft}
          screen={defaultSplitScreen}
          saving={saving}
          errorMessage={defaultSplitError}
          hasSavedDefault={Boolean(defaultSplitSummary?.group.default_split)}
          onChangeDraft={(next) => {
            setDefaultSplitDraft(next);
            setDefaultSplitError(null);
          }}
          onChangeScreen={setDefaultSplitScreen}
          onSave={() => void saveDefaultSplit()}
          onReset={() => void resetDefaultSplit()}
          onClose={closeDefaultSplitEditor}
        />

        <ThemedConfirmDialog
          visible={Boolean(soloGroupPromptSummary)}
          title="You are the only person in this group."
          message="Do you need to add anyone to your group before you start adding expenses?"
          iconName="account-multiple-plus-outline"
          confirmLabel="Start adding expenses"
          cancelLabel="Add group members"
          onCancel={() => {
            const summary = soloGroupPromptSummary;
            setSoloGroupPromptId(null);
            if (summary) openMemberPicker(summary);
          }}
          onConfirm={() => {
            const groupId = soloGroupPromptId;
            setSoloGroupPromptId(null);
            if (groupId) startBillForGroup(groupId);
          }}
        />

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

        <DeleteGroupSheet
          visible={Boolean(pendingGroupDelete)}
          groupName={pendingGroupDelete?.group.name ?? 'this group'}
          expenseCount={pendingGroupDelete?.billCount ?? 0}
          disposition={groupDeleteDisposition}
          saving={saving}
          onChangeDisposition={setGroupDeleteDisposition}
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
          onSave={(category) => void handleCreateBill(category)}
          onClose={closeModal}
        />

        <SplitModal visible={modal === 'settlement'} title="Record Settlement" onClose={closeModal}>
          <View className="gap-2">
            <TText className="text-xs" style={{ color: theme.muted }}>Friend</TText>
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

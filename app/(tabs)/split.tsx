import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useFocusEffect } from 'expo-router';
import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StateView } from '@/components/ui/StateView';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  archiveSplitFriend,
  createSplitBill,
  createSplitFriend,
  createSplitGroup,
  createSplitSettlement,
  fetchSplitActivity,
  fetchSplitBalances,
  fetchSplitBills,
  fetchSplitFriends,
  fetchSplitGroups,
  updateSplitFriend,
  updateSplitGroup,
  type SettlementDirection,
  type SplitActivityItem,
  type SplitBalance,
  type SplitBill,
  type SplitDirection,
  type SplitFriend,
  type SplitGroup,
} from '@/lib/splits';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type ModalKind = 'friend' | 'group' | 'bill' | 'settlement' | null;
type ActiveSection = 'groups' | 'friends' | 'activity';
type BalanceFilter = 'all' | 'open' | 'owed_to_me' | 'i_owe' | 'settled';
type GroupKind = 'trip' | 'home' | 'couple' | 'other';
type GroupMetadata = {
  kind: GroupKind;
  balanceAlertEnabled: boolean;
  balanceAlertAmount: string;
};
type SplitGroupSummary = {
  group: SplitGroup;
  billCount: number;
  detailLines: string[];
  latestBill?: SplitBill;
  metadata: GroupMetadata;
  memberIds: number[];
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

const formatMoney = (value: number) =>
  `₹${Math.abs(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;

const todayApiDate = () => {
  const date = new Date();
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
  if (value > 0) return { label: `you are owed ${formatMoney(value)}`, color: '#12966F' };
  if (value < 0) return { label: `you owe ${formatMoney(value)}`, color: '#DC2626' };
  return { label: 'settled up', color: '#6B7280' };
};

const getGroupKindConfig = (kind: GroupKind) =>
  groupKindOptions.find((option) => option.kind === kind) ?? groupKindOptions[3];

const inferGroupKind = (name: string): GroupKind => {
  const normalized = name.toLowerCase();
  if (/(trip|travel|stay|hotel|goa|bengaluru|himachal|vrindavan)/.test(normalized)) return 'trip';
  if (/(home|rent|flat|house|room|roommate)/.test(normalized)) return 'home';
  if (/(couple|partner|date|wedding)/.test(normalized)) return 'couple';
  return 'other';
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

type SplitScreenProps = {
  embedded?: boolean;
};

export default function SplitScreen({ embedded = false }: SplitScreenProps) {
  const { token } = useAuthStore();
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const borderColor = theme.border;

  const [friends, setFriends] = useState<SplitFriend[]>([]);
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [balances, setBalances] = useState<SplitBalance[]>([]);
  const [bills, setBills] = useState<SplitBill[]>([]);
  const [activity, setActivity] = useState<SplitActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('groups');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('open');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedGroupDetailId, setSelectedGroupDetailId] = useState<number | null>(null);
  const [selectedFriendActions, setSelectedFriendActions] = useState<SplitFriend | null>(null);
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
  const [groupMetadataById, setGroupMetadataById] = useState<Record<number, GroupMetadata>>({});

  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupKind, setGroupKind] = useState<GroupKind>('trip');
  const [groupBalanceAlertEnabled, setGroupBalanceAlertEnabled] = useState(false);
  const [groupBalanceAlertAmount, setGroupBalanceAlertAmount] = useState('');
  const [selectedGroupFriendIds, setSelectedGroupFriendIds] = useState<number[]>([]);

  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(todayApiDate());
  const [billNotes, setBillNotes] = useState('');
  const [billGroupId, setBillGroupId] = useState<number | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [shareAmount, setShareAmount] = useState('');
  const [shareDirection, setShareDirection] = useState<SplitDirection>('friend_owes_user');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);

  const [settlementFriendId, setSettlementFriendId] = useState<number | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(todayApiDate());
  const [settlementDirection, setSettlementDirection] =
    useState<SettlementDirection>('friend_paid_user');
  const [settlementNotes, setSettlementNotes] = useState('');

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load split data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      setError(
        contactError instanceof Error ? contactError.message : 'Unable to load your contacts.'
      );
    } finally {
      setContactsLoading(false);
    }
  }, []);

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

  const balanceByFriendId = useMemo(() => {
    return new Map(balances.map((balance) => [balance.friend.id, balance]));
  }, [balances]);

  const friendById = useMemo(() => {
    return new Map(friends.map((friend) => [friend.id, friend]));
  }, [friends]);

  const groupSummaries = useMemo<SplitGroupSummary[]>(() => {
    return groups.map((group) => {
      const metadata = groupMetadataById[group.id] ?? {
        kind: inferGroupKind(group.name),
        balanceAlertAmount: '',
        balanceAlertEnabled: false,
      };
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
            ? `${friend.name} owes you ${formatMoney(balance)}`
            : `You owe ${friend.name} ${formatMoney(balance)}`;
        })
        .filter((line): line is string => Boolean(line))
        .slice(0, 2);

      return {
        group,
        billCount: groupBills.length,
        detailLines,
        latestBill,
        metadata,
        memberIds,
        netBalance,
      };
    });
  }, [bills, friendById, groupMetadataById, groups]);

  const selectedGroupSummary = useMemo(
    () => groupSummaries.find((summary) => summary.group.id === selectedGroupDetailId) ?? null,
    [groupSummaries, selectedGroupDetailId]
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
          ? `${friend.name} owes you ${formatMoney(value)}`
          : `You owe ${friend.name} ${formatMoney(value)}`;
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
    setSelectedFriendId(friends[0]?.id ?? null);
    setShareAmount('');
    setShareDirection('friend_owes_user');
    setParticipants([]);
  };

  const resetSettlementForm = () => {
    setSettlementFriendId(friends[0]?.id ?? null);
    setSettlementAmount('');
    setSettlementDate(todayApiDate());
    setSettlementDirection('friend_paid_user');
    setSettlementNotes('');
  };

  const openModal = (kind: ModalKind) => {
    if (kind === 'friend') {
      resetFriendForm();
      setEditingFriendId(null);
    }
    if (kind === 'group') resetGroupForm();
    if (kind === 'bill') resetBillForm();
    if (kind === 'settlement') resetSettlementForm();
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
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this friend.');
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
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: groupName.trim(),
        friend_ids: selectedGroupFriendIds,
      };
      const savedGroup = editingGroupId
        ? await updateSplitGroup(token, editingGroupId, payload)
        : await createSplitGroup(token, payload);
      setGroupMetadataById((current) => ({
        ...current,
        [savedGroup.id]: {
          kind: groupKind,
          balanceAlertEnabled: groupBalanceAlertEnabled,
          balanceAlertAmount: groupBalanceAlertAmount.trim(),
        },
      }));
      closeModal();
      setActiveSection('groups');
      setSelectedGroupDetailId(null);
      await loadSplitData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this group.');
    } finally {
      setSaving(false);
    }
  };

  const removeFriendFromActiveList = (friend: SplitFriend, action: 'archive' | 'delete') => {
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
              setError(
                archiveError instanceof Error ? archiveError.message : 'Unable to archive friend.'
              );
            });
        },
      },
    ]);
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

  const addParticipant = () => {
    const amount = parseAmount(shareAmount);
    if (!selectedFriendId || !Number.isFinite(amount) || amount <= 0) {
      setError('Choose a friend and enter a positive share amount.');
      return;
    }
    setParticipants((current) => [
      ...current,
      { friend_id: selectedFriendId, share_amount: amount, direction: shareDirection },
    ]);
    setShareAmount('');
    setError(null);
  };

  const removeParticipant = (index: number) => {
    setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSelectBillGroup = (groupId: number | null) => {
    const nextGroup = groups.find((group) => group.id === groupId) ?? null;
    const firstMemberId = nextGroup?.members?.[0]?.friend_id ?? friends[0]?.id ?? null;
    setBillGroupId(groupId);
    setSelectedFriendId(firstMemberId);
    setParticipants([]);
  };

  const splitBillEqually = () => {
    const amount = parseAmount(billAmount);
    const targetFriendIds =
      selectedBillGroup?.members?.map((member) => member.friend_id).filter(Boolean) ??
      friends.map((friend) => friend.id);
    const uniqueFriendIds = [...new Set(targetFriendIds)];

    if (!Number.isFinite(amount) || amount <= 0 || uniqueFriendIds.length === 0) {
      setError('Enter a bill amount and choose at least one friend.');
      return;
    }

    const baseShare = Math.floor((amount / uniqueFriendIds.length) * 100) / 100;
    let allocated = 0;
    const equalParticipants = uniqueFriendIds.map((friendId, index) => {
      const share =
        index === uniqueFriendIds.length - 1 ? Number((amount - allocated).toFixed(2)) : baseShare;
      allocated += share;
      return {
        friend_id: friendId,
        share_amount: share,
        direction: shareDirection,
      };
    });

    setParticipants(equalParticipants);
    setShareAmount('');
    setError(null);
  };

  const handleCreateBill = async () => {
    if (!token || saving) return;
    const amount = parseAmount(billAmount);
    if (!billTitle.trim() || !Number.isFinite(amount) || amount <= 0 || participants.length === 0) {
      setError('Add a title, total amount, and at least one friend share.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSplitBill(token, {
        title: billTitle.trim(),
        total_amount: amount,
        currency: 'INR',
        date: billDate.trim(),
        notes: billNotes.trim(),
        group_id: billGroupId,
        participants,
      });
      closeModal();
      await loadSplitData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this split bill.');
    } finally {
      setSaving(false);
    }
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
      setError(
        saveError instanceof Error ? saveError.message : 'Unable to record this settlement.'
      );
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
    setGroupName(summary.group.name);
    setGroupKind(summary.metadata.kind);
    setGroupBalanceAlertEnabled(summary.metadata.balanceAlertEnabled);
    setGroupBalanceAlertAmount(summary.metadata.balanceAlertAmount);
    setSelectedGroupFriendIds(summary.memberIds);
    setEditingGroupId(summary.group.id);
    setError(null);
    setModal('group');
  };

  const openMemberPicker = (summary: SplitGroupSummary) => {
    setSelectedGroupDetailId(null);
    setMemberPickerGroupId(summary.group.id);
    setMemberPickerFriendIds(summary.memberIds);
    setMemberSearchQuery('');
    setError(null);
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
    setSaving(true);
    setError(null);
    try {
      await updateSplitGroup(token, memberPickerSummary.group.id, {
        name: memberPickerSummary.group.name,
        friend_ids: memberPickerFriendIds,
      });
      const groupId = memberPickerSummary.group.id;
      closeMemberPicker(false);
      setSelectedGroupDetailId(groupId);
      await loadSplitData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update group members.');
    } finally {
      setSaving(false);
    }
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
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : 'Unable to request contacts permission.'
      );
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
      setError(saveError instanceof Error ? saveError.message : 'Unable to add this contact.');
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
    if (friends.length === 0) {
      setSelectedGroupDetailId(null);
      openModal('friend');
      return;
    }
    resetBillForm();
    handleSelectBillGroup(groupId);
    setSelectedGroupDetailId(null);
    setModal('bill');
  };

  if (loading && balances.length === 0 && friends.length === 0) {
    return (
      <SplitScreenFrame embedded={embedded} backgroundColor={theme.background}>
        <View className="flex-1 justify-center">
          <StateView icon="account-multiple-outline" title="Loading splits" loading />
        </View>
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
          accessibilityLabel={`Open ${friend.name} options`}
          onPress={() => setSelectedFriendActions(friend)}
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
              {formatMoney(netBalance)} {balanceLabel}
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
    const { group, detailLines, memberIds, metadata, netBalance, billCount, latestBill } = summary;
    const tone = getBalanceTone(netBalance);
    const kindConfig = getGroupKindConfig(metadata.kind);
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
    <View key={item.id} className="flex-row items-center gap-4 py-2">
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
          {formatMoney(item.amount)}
        </TText>
      ) : null}
    </View>
  );

  return (
    <SplitScreenFrame embedded={embedded} backgroundColor={theme.background}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: embedded ? 14 : 10,
            paddingBottom: 136,
          }}>
          {!embedded && (
            <SplitTopBar
              loading={loading}
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

          {error && (
            <View className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
              <TText className="text-center text-sm text-red-600 dark:text-red-300">{error}</TText>
            </View>
          )}

          <SegmentedSections activeSection={activeSection} onChange={setActiveSection} />

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
            <View className="mt-6 gap-4">
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

        <GroupDetailModal
          summary={selectedGroupSummary}
          friends={friends}
          onClose={() => setSelectedGroupDetailId(null)}
          onAddExpense={(groupId) => openBillForGroup(groupId)}
          onManageMembers={openMemberPicker}
          onEditGroup={(summary) => {
            setSelectedGroupDetailId(null);
            openGroupEditor(summary);
          }}
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

        <SplitModal visible={modal === 'bill'} title="Add Split Bill" onClose={closeModal}>
          <FormInput label="Title" value={billTitle} onChangeText={setBillTitle} />
          <FormInput
            label="Total amount"
            value={billAmount}
            onChangeText={setBillAmount}
            keyboardType="decimal-pad"
          />
          <FormInput label="Date" value={billDate} onChangeText={setBillDate} />
          {groups.length > 0 && (
            <View className="gap-2">
              <TText className="text-xs text-black/60 dark:text-white/60">Group</TText>
              <View className="flex-row flex-wrap gap-2">
                <GroupChoiceChip
                  label="No group"
                  selected={billGroupId === null}
                  onPress={() => handleSelectBillGroup(null)}
                />
                {groups.map((group) => (
                  <GroupChoiceChip
                    key={group.id}
                    label={group.name}
                    selected={billGroupId === group.id}
                    onPress={() => handleSelectBillGroup(group.id)}
                  />
                ))}
              </View>
            </View>
          )}
          <View className="gap-2">
            <TText className="text-xs text-black/60 dark:text-white/60">Friend</TText>
            <View className="flex-row flex-wrap gap-2">
              {(selectedBillGroup?.members?.length
                ? selectedBillGroup.members
                    .map((member) => friendById.get(member.friend_id))
                    .filter((friend): friend is SplitFriend => Boolean(friend))
                : friends
              ).map((friend) => renderFriendChip(friend, selectedFriendId, setSelectedFriendId))}
            </View>
          </View>
          <View className="flex-row gap-2">
            <DirectionChip
              label="Friend owes"
              selected={shareDirection === 'friend_owes_user'}
              onPress={() => setShareDirection('friend_owes_user')}
            />
            <DirectionChip
              label="You owe"
              selected={shareDirection === 'user_owes_friend'}
              onPress={() => setShareDirection('user_owes_friend')}
            />
          </View>
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <FormInput
                label="Share amount"
                value={shareAmount}
                onChangeText={setShareAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={addParticipant}
              className="mb-1 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.accent }}>
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={splitBillEqually}
            className="min-h-11 flex-row items-center justify-center gap-2 rounded-2xl"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="call-split" size={18} color={theme.accent} />
            <TText className="text-xs" style={{ color: theme.text, fontFamily: Fonts.title }}>
              Split equally {selectedBillGroup ? `with ${selectedBillGroup.name}` : 'with friends'}
            </TText>
          </Pressable>
          {participants.length > 0 && (
            <View className="gap-2">
              {participants.map((participant, index) => {
                const friend = friendById.get(participant.friend_id);
                return (
                  <View
                    key={`${participant.friend_id}-${index}`}
                    className="flex-row items-center justify-between rounded-2xl px-3 py-2"
                    style={{ backgroundColor: theme.secondary }}>
                    <TText className="text-xs" style={{ fontFamily: Fonts.title }}>
                      {friend?.name ?? 'Friend'} • {formatMoney(participant.share_amount)}
                    </TText>
                    <Pressable accessibilityRole="button" onPress={() => removeParticipant(index)}>
                      <MaterialCommunityIcons name="close" size={18} color={theme.text} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          <FormInput label="Notes" value={billNotes} onChangeText={setBillNotes} multiline />
          <PrimaryModalButton
            label="Save bill"
            loading={saving}
            onPress={() => void handleCreateBill()}
          />
        </SplitModal>

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
  searchVisible,
  onToggleSearch,
  onCreate,
}: {
  loading: boolean;
  searchVisible: boolean;
  onToggleSearch: () => void;
  onCreate: () => void;
}) {
  const theme = useThemeTokens().colors;
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
          accessibilityLabel="Create split friend or group"
          onPress={onCreate}
          className="h-11 w-11 items-center justify-center rounded-full">
          <MaterialCommunityIcons
            name="account-multiple-plus-outline"
            size={26}
            color={theme.text}
          />
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
                    ₹
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

function GroupDetailModal({
  summary,
  friends,
  onClose,
  onAddExpense,
  onManageMembers,
  onEditGroup,
}: {
  summary: SplitGroupSummary | null;
  friends: SplitFriend[];
  onClose: () => void;
  onAddExpense: (groupId: number) => void;
  onManageMembers: (summary: SplitGroupSummary) => void;
  onEditGroup: (summary: SplitGroupSummary) => void;
}) {
  const theme = useThemeTokens().colors;
  if (!summary) return null;

  const kindConfig = getGroupKindConfig(summary.metadata.kind);
  const memberNames = summary.memberIds
    .map((memberId) => friends.find((friend) => friend.id === memberId)?.name)
    .filter(Boolean);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="min-h-[268px] overflow-hidden" style={{ backgroundColor: '#8A1238' }}>
          <View
            style={{
              position: 'absolute',
              top: -24,
              left: -28,
              width: 220,
              height: 170,
              backgroundColor: 'rgba(255,255,255,0.08)',
              transform: [{ rotate: '-24deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: -54,
              bottom: 18,
              width: 260,
              height: 140,
              backgroundColor: 'rgba(255,255,255,0.06)',
              transform: [{ rotate: '-16deg' }],
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
                  className="h-12 w-12 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons name="magnify" size={26} color="#202124" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Group settings"
                  onPress={() => onEditGroup(summary)}
                  className="h-12 w-12 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons name="cog-outline" size={26} color="#202124" />
                </Pressable>
              </View>
            </View>
            <View className="px-6 pb-8 pt-16">
              <MaterialCommunityIcons
                name={kindConfig.icon}
                size={42}
                color="rgba(255,255,255,0.78)"
              />
              <TText className="mt-4 text-4xl text-white" style={{ fontFamily: Fonts.title }}>
                {summary.group.name}
              </TText>
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 24, paddingBottom: 130 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}>
            <DetailPill label="Settle up" icon="hand-coin-outline" />
            <DetailPill label="Charts" icon="diamond-stone" />
            <DetailPill label="Balances" icon="scale-balance" />
            <DetailPill label="Totals" icon="calculator-variant-outline" />
          </ScrollView>

          <View
            className="mt-8 rounded-[24px] p-6"
            style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
            {memberNames.length === 0 ? (
              <TText className="text-center text-base" style={{ color: theme.text }}>
                You&apos;re the only one here!
              </TText>
            ) : (
              <View className="gap-3">
                {memberNames.map((memberName) => (
                  <View key={memberName} className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.secondary }}>
                      <TText style={{ color: theme.accent, fontFamily: Fonts.title }}>
                        {memberName?.charAt(0).toUpperCase()}
                      </TText>
                    </View>
                    <TText
                      className="text-base"
                      style={{ color: theme.text, fontFamily: Fonts.title }}>
                      {memberName}
                    </TText>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onManageMembers(summary)}
              className="mt-6 min-h-14 flex-row items-center justify-center gap-2 rounded-full"
              style={{ backgroundColor: theme.accent }}>
              <MaterialCommunityIcons name="account-plus-outline" size={22} color="#FFFFFF" />
              <TText className="text-base text-white" style={{ fontFamily: Fonts.title }}>
                Add group members
              </TText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Share group link', 'Group invite links are not available yet.')
              }
              className="mt-4 min-h-14 items-center justify-center rounded-full border"
              style={{ borderColor: theme.border, backgroundColor: theme.background }}>
              <TText className="text-base" style={{ color: theme.accent, fontFamily: Fonts.title }}>
                Share group link
              </TText>
            </Pressable>
          </View>
        </ScrollView>

        <FloatingExpenseButton onPress={() => onAddExpense(summary.group.id)} />
      </View>
    </Modal>
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
            <View className="items-center py-10">
              <ActivityIndicator color={theme.accent} />
              <TText className="mt-3 text-sm text-black/55 dark:text-white/55">
                Loading contacts
              </TText>
            </View>
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
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
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
          <View className="mb-3 rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
            <TText className="text-center text-sm text-red-600 dark:text-red-300">
              {errorMessage}
            </TText>
          </View>
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

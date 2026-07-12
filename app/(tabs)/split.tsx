import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StateView } from '@/components/ui/StateView';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  archiveSplitFriend,
  createSplitBill,
  createSplitFriend,
  createSplitSettlement,
  fetchSplitBalances,
  fetchSplitBills,
  fetchSplitFriends,
  fetchSplitSettlements,
  type SettlementDirection,
  type SplitBalance,
  type SplitBill,
  type SplitDirection,
  type SplitFriend,
  type SplitSettlement,
} from '@/lib/splits';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type ModalKind = 'friend' | 'bill' | 'settlement' | null;
type ParticipantDraft = {
  friend_id: number;
  share_amount: number;
  direction: SplitDirection;
};

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

export default function SplitScreen() {
  const { token } = useAuthStore();
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const borderColor = theme.border;
  const surfaceColor = theme.card;

  const [friends, setFriends] = useState<SplitFriend[]>([]);
  const [balances, setBalances] = useState<SplitBalance[]>([]);
  const [bills, setBills] = useState<SplitBill[]>([]);
  const [settlements, setSettlements] = useState<SplitSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(todayApiDate());
  const [billNotes, setBillNotes] = useState('');
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
      setBalances([]);
      setBills([]);
      setSettlements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextFriends, nextBalances, nextBills, nextSettlements] = await Promise.all([
        fetchSplitFriends(token),
        fetchSplitBalances(token),
        fetchSplitBills(token),
        fetchSplitSettlements(token),
      ]);
      setFriends(nextFriends);
      setBalances(nextBalances);
      setBills(nextBills);
      setSettlements(nextSettlements);
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

  const recentActivity = useMemo(() => {
    const billItems = bills.slice(0, 3).map((bill) => ({
      id: `bill-${bill.id}`,
      title: bill.title,
      date: bill.date,
      amount: bill.total_amount,
      icon: 'receipt-text-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      caption: `${bill.participants?.length ?? 0} share${bill.participants?.length === 1 ? '' : 's'}`,
    }));
    const settlementItems = settlements.slice(0, 3).map((settlement) => ({
      id: `settlement-${settlement.id}`,
      title:
        settlement.direction === 'friend_paid_user'
          ? `${settlement.friend?.name ?? 'Friend'} paid you`
          : `You paid ${settlement.friend?.name ?? 'friend'}`,
      date: settlement.date,
      amount: settlement.amount,
      icon: 'hand-coin-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      caption: 'Settlement',
    }));
    return [...billItems, ...settlementItems]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [bills, settlements]);

  const resetFriendForm = () => {
    setFriendName('');
    setFriendPhone('');
    setFriendEmail('');
  };

  const resetBillForm = () => {
    setBillTitle('');
    setBillAmount('');
    setBillDate(todayApiDate());
    setBillNotes('');
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
    if (kind === 'friend') resetFriendForm();
    if (kind === 'bill') resetBillForm();
    if (kind === 'settlement') resetSettlementForm();
    setError(null);
    setModal(kind);
  };

  const closeModal = () => {
    setModal(null);
    setSaving(false);
  };

  const handleCreateFriend = async () => {
    if (!token || saving) return;
    if (!friendName.trim()) {
      setError('Friend name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSplitFriend(token, {
        name: friendName.trim(),
        phone: friendPhone.trim(),
        email: friendEmail.trim(),
      });
      closeModal();
      await loadSplitData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add this friend.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveFriend = (friend: SplitFriend) => {
    Alert.alert(`Archive ${friend.name}?`, 'Archived friends stay out of new split bills.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          if (!token) return;
          setError(null);
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

  if (loading && balances.length === 0 && friends.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center">
          <StateView icon="account-multiple-outline" title="Loading splits" loading />
        </View>
      </SafeAreaView>
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

  const renderBalanceCard = (balance: SplitBalance) => {
    const isReceivable = balance.net_balance > 0;
    const isPayable = balance.net_balance < 0;
    const label = isReceivable ? 'Owes you' : isPayable ? 'You owe' : 'Settled';
    const amountColor = isReceivable ? '#16A34A' : isPayable ? '#DC2626' : theme.text;
    return (
      <View
        key={balance.friend.id}
        className="rounded-2xl border p-4"
        style={{ backgroundColor: surfaceColor, borderColor }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <TText className="text-base" style={{ fontFamily: Fonts.title }}>
              {balance.friend.name}
            </TText>
            <TText className="mt-1 text-xs text-black/60 dark:text-white/60">
              {label}
            </TText>
          </View>
          <TText className="text-base" style={{ color: amountColor, fontFamily: Fonts.title }}>
            {formatMoney(balance.net_balance)}
          </TText>
        </View>
        <View className="mt-3 flex-row gap-2">
          <MiniMetric label="From bills" value={formatMoney(balance.total_owed_by_friend)} />
          <MiniMetric label="You owe" value={formatMoney(balance.total_owed_to_friend)} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 110 }}>
          <View className="gap-2">
            <TText className="text-xl" style={{ fontFamily: Fonts.title }}>
              Split
            </TText>
            <TText className="text-sm text-black/60 dark:text-white/60">
              Track shared bills, friend balances, and settlements.
            </TText>
          </View>

          {error && (
            <View className="rounded-2xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/20">
              <TText className="text-center text-sm text-red-600 dark:text-red-300">{error}</TText>
            </View>
          )}

          <View className="flex-row gap-3">
            <SummaryCard
              icon="arrow-down-bold-circle-outline"
              label="Friends owe"
              value={formatMoney(totals.owedByFriends)}
            />
            <SummaryCard
              icon="arrow-up-bold-circle-outline"
              label="You owe"
              value={formatMoney(totals.owedToFriends)}
            />
          </View>

          <View className="flex-row gap-2">
            <ActionButton icon="account-plus-outline" label="Friend" onPress={() => openModal('friend')} />
            <ActionButton
              icon="receipt-text-plus-outline"
              label="Bill"
              onPress={() => (friends.length > 0 ? openModal('bill') : openModal('friend'))}
            />
            <ActionButton
              icon="hand-coin-outline"
              label="Settle"
              onPress={() => (friends.length > 0 ? openModal('settlement') : openModal('friend'))}
            />
          </View>

          {friends.length === 0 ? (
            <StateView
              icon="account-multiple-plus-outline"
              title="Add friends to split bills"
              message="Create friends first, then add shares and settlements against them."
              actionLabel="Add friend"
              onAction={() => openModal('friend')}
              compact
            />
          ) : (
            <>
              <SectionHeader title="Balances" count={balances.length} />
              <View className="gap-3">{balances.map(renderBalanceCard)}</View>

              <SectionHeader title="Friends" count={friends.length} />
              <View className="gap-2">
                {friends.map((friend) => (
                  <View
                    key={friend.id}
                    className="flex-row items-center justify-between rounded-2xl border p-4"
                    style={{ backgroundColor: surfaceColor, borderColor }}>
                    <View className="flex-1">
                      <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                        {friend.name}
                      </TText>
                      <TText className="text-xs text-black/60 dark:text-white/60">
                        {[friend.phone, friend.email].filter(Boolean).join(' • ') || 'No contact'}
                      </TText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleArchiveFriend(friend)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.secondary }}>
                      <MaterialCommunityIcons name="archive-outline" size={18} color={theme.text} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}

          {recentActivity.length > 0 && (
            <>
              <SectionHeader title="Recent activity" count={recentActivity.length} />
              <View className="gap-2">
                {recentActivity.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center gap-3 rounded-2xl border p-4"
                    style={{ backgroundColor: surfaceColor, borderColor }}>
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.secondary }}>
                      <MaterialCommunityIcons name={item.icon} size={18} color={theme.accent} />
                    </View>
                    <View className="flex-1">
                      <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                        {item.title}
                      </TText>
                      <TText className="text-xs text-black/60 dark:text-white/60">
                        {item.caption} • {item.date}
                      </TText>
                    </View>
                    <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                      {formatMoney(item.amount)}
                    </TText>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <SplitModal visible={modal === 'friend'} title="Add Friend" onClose={closeModal}>
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
          <PrimaryModalButton
            label="Save friend"
            loading={saving}
            onPress={() => void handleCreateFriend()}
          />
        </SplitModal>

        <SplitModal visible={modal === 'bill'} title="Add Split Bill" onClose={closeModal}>
          <FormInput label="Title" value={billTitle} onChangeText={setBillTitle} />
          <FormInput
            label="Total amount"
            value={billAmount}
            onChangeText={setBillAmount}
            keyboardType="decimal-pad"
          />
          <FormInput label="Date" value={billDate} onChangeText={setBillDate} />
          <View className="gap-2">
            <TText className="text-xs text-black/60 dark:text-white/60">Friend</TText>
            <View className="flex-row flex-wrap gap-2">
              {friends.map((friend) => renderFriendChip(friend, selectedFriendId, setSelectedFriendId))}
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
          {participants.length > 0 && (
            <View className="gap-2">
              {participants.map((participant, index) => {
                const friend = friends.find((item) => item.id === participant.friend_id);
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
          <FormInput
            label="Notes"
            value={billNotes}
            onChangeText={setBillNotes}
            multiline
          />
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
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="flex-1 rounded-2xl border p-4" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.accent} />
      <TText className="mt-3 text-xs text-black/60 dark:text-white/60">{label}</TText>
      <TText className="mt-1 text-base" style={{ fontFamily: Fonts.title }}>
        {value}
      </TText>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 items-center gap-2 rounded-2xl py-3"
      style={{ backgroundColor: theme.accent }}>
      <MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" />
      <TText className="text-xs text-white" style={{ fontFamily: Fonts.title }}>
        {label}
      </TText>
    </Pressable>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View className="mt-1 flex-row items-center justify-between">
      <TText className="text-base" style={{ fontFamily: Fonts.title }}>
        {title}
      </TText>
      <TText className="text-xs text-black/50 dark:text-white/50">{count}</TText>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens().colors;
  return (
    <View className="flex-1 rounded-2xl px-3 py-2" style={{ backgroundColor: theme.secondary }}>
      <TText className="text-[10px] text-black/60 dark:text-white/60">{label}</TText>
      <TText className="text-xs" style={{ fontFamily: Fonts.title }}>
        {value}
      </TText>
    </View>
  );
}

function SplitModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40">
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

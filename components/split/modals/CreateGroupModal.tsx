import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MemberToggleChip,
  SwitchControl,
} from '@/components/split/primitives/SplitPrimitives';
import { ThemedText } from '@/components/themed-text';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { GroupKind } from '@/lib/split-preferences';
import type { SplitFriend } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

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

export function CreateGroupModal({
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
                color={`${theme.text}E6`}
              />
            </Pressable>
            <View className="flex-1">
              <TText className="text-sm text-black/60 dark:text-white/60">Group name</TText>
              <TextInput
                value={groupName}
                onChangeText={onChangeName}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={`${theme.text}B3`}
                style={{
                  minHeight: 48,
                  borderBottomWidth: 2,
                  borderColor: groupName ? `${theme.text}8C` : theme.accent,
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
              <TText className="text-lg" style={{ color: theme.accent, fontFamily: Fonts.title }}>
                Set balance alert
              </TText>
              <MaterialCommunityIcons name="diamond-stone" size={18} color={theme.accent} />
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
                  placeholderTextColor={`${theme.text}BF`}
                  style={{
                    flex: 1,
                    minHeight: 64,
                    borderBottomWidth: 2,
                    borderColor: balanceAlertAmount ? theme.accent : `${theme.text}8C`,
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
        color={selected ? theme.accent : `${theme.text}E6`}
      />
      <TText
        className="text-base"
        style={{ color: selected ? theme.accent : theme.text, fontFamily: Fonts.title }}>
        {option.label}
      </TText>
    </Pressable>
  );
}

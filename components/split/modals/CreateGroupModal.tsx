import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { MemberToggleChip } from '@/components/split/primitives/SplitPrimitives';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { HapticSwitch } from '@/components/ui/HapticSwitch';
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
}[] = [
  { kind: 'trip', label: 'Trip', icon: 'airplane' },
  { kind: 'home', label: 'Home', icon: 'home-outline' },
  { kind: 'couple', label: 'Couple', icon: 'heart-outline' },
  { kind: 'other', label: 'Other', icon: 'format-list-bulleted' },
];

export function CreateGroupModal({
  visible,
  saving,
  title,
  doneLabel,
  groupName,
  groupKind,
  photoUri,
  photoBusy,
  onPickPhoto,
  onRemovePhoto,
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
  /**
   * The photo as the composer has it: a local file the user just picked, a
   * hosted URL on an existing group, `''` once removed, or `null` for a group
   * that has never had one.
   */
  photoUri: string | null;
  photoBusy: boolean;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
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
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      avoidKeyboard
      sheetStyle={{ maxHeight: '94%' }}>
      <View
        className="overflow-hidden rounded-t-[28px] border"
        style={{ backgroundColor: theme.background, borderColor: theme.border, flexShrink: 1 }}>
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
          <TText variant="screenTitle" className="flex-1 text-center">
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
              <TText variant="button" style={{ color: theme.text }}>
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
            {/* The control was drawn from the first version of this sheet and
                wired to nothing, so the one affordance that looks like it takes
                a photo did not. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUri ? 'Change group photo' : 'Choose group photo'}
              accessibilityHint={photoUri ? 'Opens the picker to replace this photo' : undefined}
              disabled={photoBusy}
              onPress={onPickPhoto}
              className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border"
              style={{
                backgroundColor: theme.card,
                borderColor: photoUri ? theme.accent : theme.border,
                opacity: photoBusy ? 0.6 : 1,
              }}>
              {photoBusy ? (
                <ActivityIndicator color={theme.accent} />
              ) : photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={{ height: '100%', width: '100%' }}
                  contentFit="cover"
                  transition={0}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <MaterialCommunityIcons
                  name="camera-plus-outline"
                  size={30}
                  color={theme.mutedStrong}
                />
              )}
            </Pressable>
            <View className="flex-1">
              <TText className="text-sm" style={{ color: theme.muted }}>Group name</TText>
              <TextInput
                value={groupName}
                onChangeText={onChangeName}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={theme.mutedStrong}
                style={{
                  minHeight: 48,
                  borderBottomWidth: 2,
                  borderColor: groupName ? theme.muted : theme.accent,
                  color: theme.text,
                  fontFamily: Fonts.body,
                  fontSize: 20,
                }}
              />
              {photoUri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove group photo"
                  onPress={onRemovePhoto}
                  hitSlop={8}
                  className="mt-2 self-start">
                  <TText className="text-sm" style={{ color: theme.accent }}>
                    Remove photo
                  </TText>
                </Pressable>
              ) : null}
            </View>
          </View>

          <TText
            className="mt-8 text-base"
            style={{ color: theme.mutedStrong, fontFamily: Fonts.title }}>
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
              <TText variant="sectionTitle" style={{ color: theme.accent }}>
                Set balance alert
              </TText>
              <MaterialCommunityIcons name="diamond-stone" size={18} color={theme.accent} />
            </View>
            <HapticSwitch
              value={balanceAlertEnabled}
              onValueChange={onToggleBalanceAlert}
              trackColor={{ false: theme.secondary, true: theme.accent }}
              thumbColor={theme.onAccent}
              ios_backgroundColor={theme.secondary}
            />
          </View>
          <TText className="mt-5 text-base leading-6" style={{ color: theme.muted }}>
            Finnri can mark this group when someone reaches a balance limit.
          </TText>

          {balanceAlertEnabled ? (
            <View className="mt-8">
              <TText
                className="text-base"
                style={{ color: theme.mutedStrong, fontFamily: Fonts.title }}>
                Balance amount
              </TText>
              <View className="mt-3 flex-row items-center gap-5">
                <View
                  className="h-16 w-16 items-center justify-center rounded-lg border"
                  style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  <TText variant="amount" style={{ color: theme.text }}>
                    {CURRENCY_SYMBOL}
                  </TText>
                </View>
                <TextInput
                  value={balanceAlertAmount}
                  onChangeText={onChangeBalanceAlertAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.mutedStrong}
                  style={{
                    flex: 1,
                    minHeight: 64,
                    borderBottomWidth: 2,
                    borderColor: balanceAlertAmount ? theme.accent : theme.muted,
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
              className="text-base"
              style={{ color: theme.mutedStrong, fontFamily: Fonts.title }}>
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
                <TText className="text-sm" style={{ color: theme.muted }}>
                  No friends yet. You can add members after creating friends.
                </TText>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </AnimatedBottomSheet>
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
        color={selected ? theme.accent : theme.mutedStrong}
      />
      <TText
        className="text-base"
        style={{ color: selected ? theme.accent : theme.text, fontFamily: Fonts.title }}>
        {option.label}
      </TText>
    </Pressable>
  );
}

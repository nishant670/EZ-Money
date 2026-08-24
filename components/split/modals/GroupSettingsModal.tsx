import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AvatarCircle,
  SwitchControl,
} from '@/components/split/primitives/SplitPrimitives';
import { GroupTile } from '@/components/split/rows/GroupTile';
import { getGroupKindConfig } from '@/components/split/split-utils';
import type { SplitGroupSummary } from '@/components/split/split-types';
import { ThemedText } from '@/components/themed-text';
import { SkeletonFrame, SkeletonRows } from '@/components/ui/Skeleton';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SplitFriend, SplitGroupDirectInvite } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export function GroupSettingsModal({
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
            <MaterialCommunityIcons name="format-list-bulleted" size={27} color={theme.accent} />
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <TText className="text-xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
                  Default split
                </TText>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.secondary }}>
                  <TText className="text-xs" style={{ color: theme.accent, fontFamily: Fonts.title }}>
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
  const color = destructive ? theme.negative : theme.text;
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
        <MaterialCommunityIcons name="trash-can-outline" size={21} color={theme.negative} />
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

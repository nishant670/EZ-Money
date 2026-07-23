import type { ParseResponse } from './parse';
import type { SplitFriend, SplitGroup } from './splits';

export type ResolvedSplitParticipant = {
  friendId: number | null;
  friendName: string;
  shareAmount: string;
  direction: 'friend_owes_user' | 'user_owes_friend';
};

export type ResolvedSplitDraft = {
  splitEnabled: boolean;
  splitGroupId: number | null;
  splitGroupName: string;
  splitParticipants: ResolvedSplitParticipant[];
};

const normalizeLookup = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()[\]"']/g, ' ')
    .replace(/\s+/g, ' ');

const findByName = <T extends { name: string }>(items: T[], name?: string | null): T | null => {
  const normalizedName = normalizeLookup(name);
  if (!normalizedName) return null;

  const exact = items.find((item) => normalizeLookup(item.name) === normalizedName);
  if (exact) return exact;

  const partialMatches = items.filter((item) => {
    const normalizedItemName = normalizeLookup(item.name);
    return (
      normalizedItemName.includes(normalizedName) || normalizedName.includes(normalizedItemName)
    );
  });
  return partialMatches.length === 1 ? partialMatches[0] : null;
};

const formatShare = (value: number | null) =>
  value != null && Number.isFinite(value) && value > 0 ? value.toFixed(2) : '';

const defaultEqualShare = (amount: number | null | undefined, friendCount: number) => {
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || friendCount <= 0) {
    return null;
  }
  return amount / (friendCount + 1);
};

const sumShares = (participants: ResolvedSplitParticipant[]) =>
  participants.reduce((sum, participant) => sum + Number(participant.shareAmount || 0), 0);

const rebalanceIfSharesExceedAmount = (
  participants: ResolvedSplitParticipant[],
  amount: number | null | undefined
) => {
  if (
    participants.length <= 1 ||
    amount == null ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    sumShares(participants) <= amount
  ) {
    return participants;
  }

  const equalShare = defaultEqualShare(amount, participants.length);
  return participants.map((participant) => ({
    ...participant,
    shareAmount: formatShare(equalShare),
  }));
};

export const buildParticipantsForGroup = (
  group: SplitGroup,
  amount?: number | string | null
): ResolvedSplitParticipant[] => {
  const members = group.members?.filter((member) => member.friend) ?? [];
  const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
  const share = defaultEqualShare(numericAmount, members.length);

  return members.map((member) => ({
    friendId: member.friend_id,
    friendName: '',
    shareAmount: formatShare(share),
    direction: 'friend_owes_user',
  }));
};

export const resolveSplitDraft = (
  data: ParseResponse,
  splitFriends: SplitFriend[],
  splitGroups: SplitGroup[]
): ResolvedSplitDraft => {
  const candidate = data.split_candidate_details;
  const matchedGroup = findByName(splitGroups, candidate?.group_name);
  const participantCandidates = candidate?.participants ?? [];
  const participantCount = participantCandidates.length || matchedGroup?.members?.length || 1;
  const fallbackShare = defaultEqualShare(data.amount, participantCount);

  const splitParticipants = participantCandidates
    .map((participant) => {
      const friendName = participant.friend_name?.trim() ?? '';
      const matchingFriend = findByName(splitFriends, friendName);
      const shareAmount =
        participant.share_amount != null && participant.share_amount > 0
          ? participant.share_amount
          : fallbackShare;

      return {
        friendId: matchingFriend?.id ?? null,
        friendName: matchingFriend ? '' : friendName,
        shareAmount: formatShare(shareAmount),
        direction: participant.direction ?? 'friend_owes_user',
      };
    })
    .filter(
      (participant) => participant.friendId || participant.friendName || participant.shareAmount
    );
  const balancedSplitParticipants = rebalanceIfSharesExceedAmount(splitParticipants, data.amount);

  const groupParticipants =
    balancedSplitParticipants.length === 0 && matchedGroup
      ? buildParticipantsForGroup(matchedGroup, data.amount)
      : [];

  return {
    splitEnabled: Boolean(
      data.split_candidate || balancedSplitParticipants.length > 0 || matchedGroup
    ),
    splitGroupId: matchedGroup?.id ?? null,
    splitGroupName: matchedGroup ? '' : (candidate?.group_name?.trim() ?? ''),
    splitParticipants:
      balancedSplitParticipants.length > 0 ? balancedSplitParticipants : groupParticipants,
  };
};

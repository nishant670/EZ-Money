import { formatMoney, roundToPaise } from './money';
import {
  SPLIT_GROUP_OWNER_SLOT,
  type SplitGroup,
  type SplitGroupDefaultSplit,
  type SplitGroupDefaultSplitTab,
  type SplitGroupKind,
  type SplitGroupMemberInvite,
} from './splits';

export type AdjustSplitTab = 'equally' | 'unequally' | 'percentages' | 'shares';

/**
 * A default split has to survive until the next expense, so it can only be a
 * ratio. Exact amounts describe one bill and nothing else.
 */
export const isDefaultSplitTab = (tab: AdjustSplitTab): tab is SplitGroupDefaultSplitTab =>
  tab !== 'unequally';

/**
 * The key standing for the person doing the splitting inside the expense
 * composer. The composer works in its author's own frame, where every other
 * participant is one of their friend rows.
 */
export const CURRENT_USER_KEY = 'me';

export const friendSplitKey = (friendId: number) => String(friendId);

export type SplitWeights = Record<string, string>;

/**
 * Who is in a split and how heavily each of them carries it, in whatever key
 * space the caller is working in — `me`/friend ids in the expense composer,
 * owner/friend-id slots in the group's shared default.
 *
 * `selfKey` is the person the split is being recorded for, which is the only
 * thing the two frames disagree about.
 */
export type SplitSelection = {
  selfKey: string;
  payerKey: string;
  fullAmount: boolean;
  participantKeys: string[];
  tab: AdjustSplitTab;
  weights: SplitWeights;
};

/**
 * Who actually carries a share.
 *
 * "Owed the full amount" means the payer carries none of it. When somebody else
 * paid, the whole amount lands on the person recording it rather than being
 * spread across people the bill has no way to name — a bill records debts owed
 * to and by its author, never between two other members.
 */
export const splitParticipantKeys = (selection: SplitSelection) => {
  const keys = [...new Set(selection.participantKeys)];
  if (!selection.fullAmount) return keys;
  return selection.payerKey === selection.selfKey
    ? keys.filter((key) => key !== selection.payerKey)
    : [selection.selfKey];
};

const parseWeight = (value: string | undefined) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const sumSplitWeights = (keys: string[], weights: SplitWeights) =>
  keys.reduce((total, key) => total + parseWeight(weights[key]), 0);

/**
 * Largest-remainder allocation. Flooring every share to paise leaves a few
 * paise unspent; handing them out in order of the fraction that was dropped
 * keeps the shares summing to the bill exactly without any one person
 * silently absorbing the rounding on every expense.
 */
const allocate = (amount: number, ratios: number[]): number[] => {
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (total <= 0) return ratios.map(() => 0);
  const exact = ratios.map((ratio) => (amount * ratio) / total);
  const shares = exact.map((value) => Math.floor(value * 100) / 100);
  const order = exact
    .map((value, index) => ({ index, remainder: value - shares[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  let leftoverPaise = Math.round((amount - shares.reduce((sum, value) => sum + value, 0)) * 100);
  let cursor = 0;
  while (leftoverPaise > 0 && order.length > 0) {
    const target = order[cursor % order.length].index;
    shares[target] = roundToPaise(shares[target] + 0.01);
    leftoverPaise -= 1;
    cursor += 1;
  }
  return shares;
};

export type SplitShareResult =
  | { ok: true; shares: Record<string, number> }
  | { ok: false; error: string };

/**
 * Turns "who is in the split, weighted how" into rupee shares for one amount.
 * Every tab funnels through here so an expense saved from the composer and one
 * saved from a group default cannot disagree about what 60/40 means.
 */
export const computeSplitShares = ({
  amount,
  tab,
  keys,
  weights,
}: {
  amount: number;
  tab: AdjustSplitTab;
  keys: string[];
  weights: SplitWeights;
}): SplitShareResult => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a bill amount before choosing the split.' };
  }
  if (keys.length === 0) {
    return { ok: false, error: 'Choose at least one person for this split.' };
  }

  if (tab === 'equally') {
    const values = allocate(amount, keys.map(() => 1));
    return { ok: true, shares: Object.fromEntries(keys.map((key, index) => [key, values[index]])) };
  }

  const ratios = keys.map((key) => parseWeight(weights[key]));
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);

  if (tab === 'unequally') {
    if (Math.abs(total - amount) > 0.009) {
      return {
        ok: false,
        error: `Shares add up to ${formatMoney(total, { sign: 'never' })} of ${formatMoney(amount, {
          sign: 'never',
        })}.`,
      };
    }
    return {
      ok: true,
      shares: Object.fromEntries(keys.map((key, index) => [key, roundToPaise(ratios[index])])),
    };
  }

  if (tab === 'percentages' && Math.abs(total - 100) > 0.009) {
    return { ok: false, error: `Percentages add up to ${total.toFixed(2)}%, not 100%.` };
  }

  if (total <= 0) {
    return {
      ok: false,
      error:
        tab === 'percentages' ? 'Enter a percentage for each person.' : 'Enter at least one share.',
    };
  }

  const values = allocate(amount, ratios);
  return { ok: true, shares: Object.fromEntries(keys.map((key, index) => [key, values[index]])) };
};

/**
 * Switching to a weighted tab with every field blank reads as broken, so the
 * first view of it is the equal split the user was already on, written out —
 * 50/50 to edit into 60/40 rather than nothing to start from.
 */
export const buildSeedWeights = (tab: AdjustSplitTab, selection: SplitSelection): SplitWeights => {
  const keys = splitParticipantKeys({ ...selection, tab });
  if (keys.length === 0) return {};
  if (tab === 'shares') return Object.fromEntries(keys.map((key) => [key, '1']));
  if (tab !== 'percentages') return {};
  const base = Math.floor(10000 / keys.length);
  const hundredths = keys.map(() => base);
  let leftover = 10000 - base * keys.length;
  for (let index = 0; leftover > 0; index += 1, leftover -= 1) {
    hundredths[index % hundredths.length] += 1;
  }
  return Object.fromEntries(keys.map((key, index) => [key, (hundredths[index] / 100).toFixed(2)]));
};

/**
 * Which slot of a shared group is the person reading it. The owner is never one
 * of their own friend rows, so they are always the owner slot; everybody else
 * is the member row the server linked to their account.
 */
export const viewerSplitSlot = (group: SplitGroup) =>
  group.viewer_role === 'member' && group.viewer_friend_id
    ? friendSplitKey(group.viewer_friend_id)
    : SPLIT_GROUP_OWNER_SLOT;

/**
 * The group's roster as friend rows the *viewer* owns.
 *
 * For the owner that is simply the membership list — the roster is already
 * written in their namespace. For everybody else it is `viewer_slot_friends`,
 * the server's translation of that roster into the viewer's own friend ids,
 * which is the only namespace their bills can name.
 */
export const groupComposerMembers = (
  group: SplitGroup | null | undefined
): { friend_id: number }[] | undefined => {
  // Undefined rather than empty, so "no group chosen" keeps falling through to
  // the whole friends list the way it always has. An empty array means a group
  // that genuinely has nobody in it.
  if (!group) return undefined;
  if (group.viewer_role === 'member') {
    const slotFriends = group.viewer_slot_friends ?? {};
    // Owner first, then the roster's own order. Reading the map's own key order
    // would put the numeric slots ahead of 'owner', which is neither the order
    // the group is written in nor the one every other screen shows.
    const slots = [
      SPLIT_GROUP_OWNER_SLOT,
      ...(group.members ?? []).map((member) => friendSplitKey(member.friend_id)),
    ];
    // A slot with no translation drops out: the viewer's own row, which has
    // none by design, and anyone who has since left the group.
    return slots
      .map((slot) => slotFriends[slot])
      .filter((friendId): friendId is number => Boolean(friendId))
      .map((friendId) => ({ friend_id: friendId }));
  }
  return (group.members ?? []).map((member) => ({ friend_id: member.friend_id }));
};

/** The group's roster in slot space: the owner, then every member friend row. */
export type SplitSlotPerson = { key: string; label: string; subtitle: string };

export const groupSplitSlots = (
  group: SplitGroup,
  friendName: (friendId: number) => string,
  friendContact: (friendId: number) => string,
  currentUserName: string,
  currentUserContact: string
): SplitSlotPerson[] => {
  const selfSlot = viewerSplitSlot(group);

  // The server's roster, which names each slot with the *reader's* own row for
  // that person. Preferred over the raw membership list: that one is written in
  // the owner's names, and on a member's phone half of it resolved to nothing
  // at all.
  if (group.viewer_members && group.viewer_members.length > 0) {
    return group.viewer_members.map((member) =>
      member.is_viewer
        ? { key: member.slot, label: currentUserName, subtitle: currentUserContact }
        : {
            key: member.slot,
            // The server already resolved this to the reader's own row for the
            // person; `friendName` only fills in when it could not.
            label: member.name || friendName(member.friend_id),
            subtitle:
              [member.phone, member.email].filter(Boolean).join(' • ') ||
              friendContact(member.friend_id),
          }
    );
  }

  const owner: SplitSlotPerson =
    selfSlot === SPLIT_GROUP_OWNER_SLOT
      ? { key: SPLIT_GROUP_OWNER_SLOT, label: currentUserName, subtitle: currentUserContact }
      : {
          key: SPLIT_GROUP_OWNER_SLOT,
          label: group.owner_name || 'Group owner',
          subtitle: 'Group owner',
        };
  const members = (group.members ?? []).map((member) => {
    const key = friendSplitKey(member.friend_id);
    return key === selfSlot
      ? { key, label: currentUserName, subtitle: currentUserContact }
      : { key, label: friendName(member.friend_id), subtitle: friendContact(member.friend_id) };
  });
  return [owner, ...members];
};

export const defaultSplitToSelection = (
  group: SplitGroup,
  value: SplitGroupDefaultSplit
): SplitSelection => ({
  selfKey: viewerSplitSlot(group),
  // Not `value.payer`. The stored payer is only there so `full_amount` has
  // somebody to be about; the split itself is applied with the person entering
  // the expense as the payer, so the editor has to open on the same reading or
  // it would show every member a default their own composer never uses.
  payerKey: viewerSplitSlot(group),
  fullAmount: Boolean(value.full_amount),
  participantKeys: value.participants.map((participant) => participant.slot),
  tab: value.tab,
  weights: Object.fromEntries(
    value.participants
      .filter((participant) => participant.weight)
      .map((participant) => [participant.slot, participant.weight as string])
  ),
});

export const selectionToDefaultSplit = (
  selection: SplitSelection
): SplitGroupDefaultSplit | null => {
  if (!isDefaultSplitTab(selection.tab)) return null;
  return {
    payer: selection.payerKey,
    full_amount: selection.fullAmount,
    tab: selection.tab,
    participants: [...new Set(selection.participantKeys)].map((slot) => ({
      slot,
      ...(selection.tab === 'equally' ? {} : { weight: selection.weights[slot] ?? '' }),
    })),
  };
};

/**
 * A shared default names people by the group owner's friend ids, but the expense
 * composer works in its author's own frame, where the only people it can name
 * are their own friend rows plus themselves.
 *
 * For the owner every slot translates directly. For a member it goes through
 * `viewer_slot_friends` — the roster rendered in their namespace — which is
 * what lets the owner's slot translate at all. Before those links existed the
 * owner had no counterpart in a member's frame, so every default containing the
 * owner (which is nearly all of them) was refused and silently replaced with an
 * equal split: a group set to 60/40 divided 50/50 on the member's phone.
 *
 * The payer is deliberately *not* translated. A default split is a ratio the
 * group has agreed on; who laid the money out is a fact about one evening, and
 * it is the person entering the expense. Anchoring it on a stored name meant
 * the wife's composer opened pre-set to "Nishant Munjal paid" every time she
 * added something she had bought — and, because the mirror-to-transaction step
 * only fires when the composer's author is the payer, quietly recorded no
 * spend of hers either. `payer` survives in the stored document for the sake
 * of `full_amount`, which is a statement about the payer's own share.
 *
 * A slot that cannot be mapped — somebody who has left the group — is reported
 * as unmappable rather than handed back as a half-applied split.
 */
export const defaultSplitToComposerKeys = (
  group: SplitGroup,
  value: SplitGroupDefaultSplit
): { payerKey: string; participantKeys: string[]; weights: SplitWeights } | null => {
  const selfSlot = viewerSplitSlot(group);
  const isMember = group.viewer_role === 'member';
  const slotFriends = group.viewer_slot_friends ?? {};
  const memberSlots = new Set((group.members ?? []).map((member) => friendSplitKey(member.friend_id)));
  const toComposerKey = (slot: string) => {
    if (slot === selfSlot) return CURRENT_USER_KEY;
    if (isMember) {
      const friendId = slotFriends[slot];
      return friendId ? friendSplitKey(friendId) : null;
    }
    if (memberSlots.has(slot)) return slot;
    return null;
  };

  const participantKeys: string[] = [];
  const weights: SplitWeights = {};
  for (const participant of value.participants) {
    const key = toComposerKey(participant.slot);
    if (!key) return null;
    participantKeys.push(key);
    if (participant.weight) weights[key] = participant.weight;
  }
  return { payerKey: CURRENT_USER_KEY, participantKeys, weights };
};

/**
 * What to tell the user after adding people to a group.
 *
 * There is exactly one delivery channel and it only reaches people who already
 * use Finnri: an in-app notification. There is no mail server and no SMS
 * provider behind any of this, so for everybody else the link sits with the
 * owner until they send it themselves.
 *
 * Saying which of the two happened, by name, is the whole job. Staying vague
 * lets somebody assume their wife knows about the group when nothing left the
 * device — and that assumption is expensive: the person never turns up, the
 * owner adds them again under a different address, and now there are two of
 * them in the ledger.
 */
export const describeMemberInvites = (invites: SplitGroupMemberInvite[]) => {
  if (invites.length === 0) return null;
  const named = (statuses: SplitGroupMemberInvite['status'][]) =>
    invites
      .filter((invite) => statuses.includes(invite.status))
      .map((invite) => invite.name);

  const notified = named(['notified']);
  const shareLink = named(['invite_created', 'no_contact']);
  const noContact = named(['no_contact']);

  const lines: string[] = [];
  if (notified.length > 0) {
    lines.push(
      `${notified.join(', ')} already ${notified.length === 1 ? 'uses' : 'use'} Finnri — the invite is waiting in their notifications.`
    );
  }
  const linkOnly = shareLink.filter((name) => !noContact.includes(name));
  if (linkOnly.length > 0) {
    lines.push(
      `${linkOnly.join(', ')} ${linkOnly.length === 1 ? 'is' : 'are'} not on Finnri yet.`
    );
  }
  if (noContact.length > 0) {
    lines.push(
      `${noContact.join(', ')} ${noContact.length === 1 ? 'has' : 'have'} no email or phone saved, so Finnri will not recognise ${noContact.length === 1 ? 'them' : 'them'} automatically when they join.`
    );
  }
  if (shareLink.length > 0) {
    lines.push(
      'Finnri does not send emails or texts — share an invite link with them from group settings.'
    );
  }
  lines.push('You can keep adding expenses for them either way — they only see the group once they accept.');
  return lines.join('\n\n');
};

export const describeSplitTab = (tab: AdjustSplitTab) => {
  if (tab === 'unequally') return 'split by exact amounts';
  if (tab === 'percentages') return 'split by percentages';
  if (tab === 'shares') return 'split by shares';
  return 'split equally';
};

/**
 * The one-line summary under "Default split" in group settings. It has to name
 * the actual numbers, because the whole point of the setting is that the user
 * stops seeing the split screen on every expense.
 */
export const describeGroupDefaultSplit = (
  value: SplitGroupDefaultSplit | null | undefined,
  slotLabel: (slot: string) => string
) => {
  if (!value) return 'Not set — new expenses start split equally';
  // Always "you". The payer is whoever is adding the expense — see
  // `defaultSplitToComposerKeys` — so naming somebody here would describe a
  // split nobody's composer actually opens on.
  if (value.full_amount) return 'Paid by you, owed the full amount';
  if (value.tab === 'equally') return 'Paid by you and split equally';
  const suffix = value.tab === 'percentages' ? '%' : ' shares';
  const parts = value.participants.map(
    (participant) => `${slotLabel(participant.slot)} ${participant.weight ?? '0'}${suffix}`
  );
  return `Paid by you, ${describeSplitTab(value.tab)} (${parts.join(', ')})`;
};

export type { SplitGroupKind as GroupKind };

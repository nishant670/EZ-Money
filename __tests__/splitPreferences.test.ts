import {
  computeSplitShares,
  CURRENT_USER_KEY,
  defaultSplitToComposerKeys,
  describeGroupDefaultSplit,
  describeMemberInvites,
  groupSplitSlots,
  viewerSplitSlot,
} from '@/lib/split-preferences';
import type { SplitGroup, SplitGroupDefaultSplit } from '@/lib/splits';

const shares = (result: ReturnType<typeof computeSplitShares>) => {
  if (!result.ok) throw new Error(`expected shares, got: ${result.error}`);
  return result.shares;
};

describe('computeSplitShares', () => {
  it('splits equally without losing paise to rounding', () => {
    const result = shares(
      computeSplitShares({
        amount: 100,
        tab: 'equally',
        keys: [CURRENT_USER_KEY, '7', '9'],
        weights: {},
      })
    );

    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
    expect(Object.values(result).sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it('honours a 60/40 percentage split', () => {
    const result = shares(
      computeSplitShares({
        amount: 2500,
        tab: 'percentages',
        keys: [CURRENT_USER_KEY, '4'],
        weights: { [CURRENT_USER_KEY]: '60', '4': '40' },
      })
    );

    expect(result[CURRENT_USER_KEY]).toBe(1500);
    expect(result['4']).toBe(1000);
  });

  it('refuses percentages that do not reach 100', () => {
    const result = computeSplitShares({
      amount: 1000,
      tab: 'percentages',
      keys: [CURRENT_USER_KEY, '4'],
      weights: { [CURRENT_USER_KEY]: '60', '4': '30' },
    });

    expect(result.ok).toBe(false);
  });

  it('treats shares as ratios rather than amounts', () => {
    const result = shares(
      computeSplitShares({
        amount: 900,
        tab: 'shares',
        keys: [CURRENT_USER_KEY, '4'],
        weights: { [CURRENT_USER_KEY]: '2', '4': '1' },
      })
    );

    expect(result[CURRENT_USER_KEY]).toBe(600);
    expect(result['4']).toBe(300);
  });

  it('refuses exact amounts that do not add up to the bill', () => {
    const result = computeSplitShares({
      amount: 1000,
      tab: 'unequally',
      keys: [CURRENT_USER_KEY, '4'],
      weights: { [CURRENT_USER_KEY]: '600', '4': '300' },
    });

    expect(result.ok).toBe(false);
  });
});

describe('describeGroupDefaultSplit', () => {
  const ownerGroup = {
    id: 1,
    user_id: 9,
    name: 'Home',
    archived: false,
    owner_name: 'Nishant',
    viewer_role: 'owner',
    members: [{ id: 1, user_id: 9, group_id: 1, friend_id: 4 }],
  } as SplitGroup;
  const slotLabel = (slot: string) => (slot === 'owner' ? 'Nishant' : 'Priya');

  it('falls back to the equal split when nothing is saved', () => {
    expect(describeGroupDefaultSplit(ownerGroup, null, slotLabel)).toBe(
      'Not set — new expenses start split equally'
    );
  });

  it('names the saved percentages', () => {
    const value: SplitGroupDefaultSplit = {
      payer: 'owner',
      tab: 'percentages',
      participants: [
        { slot: 'owner', weight: '60' },
        { slot: '4', weight: '40' },
      ],
    };

    expect(describeGroupDefaultSplit(ownerGroup, value, slotLabel)).toBe(
      'Paid by you, split by percentages (Nishant 60%, Priya 40%)'
    );
  });
});

describe('shared group frames', () => {
  const group = {
    id: 1,
    user_id: 9,
    name: 'Home',
    archived: false,
    owner_name: 'Nishant',
    viewer_role: 'member',
    viewer_friend_id: 4,
    members: [
      { id: 1, user_id: 9, group_id: 1, friend_id: 4 },
      { id: 2, user_id: 9, group_id: 1, friend_id: 7 },
    ],
  } as SplitGroup;

  it('marks the member\'s own slot as themselves and names the owner', () => {
    const slots = groupSplitSlots(
      group,
      (friendId) => (friendId === 4 ? 'Priya' : 'Arjun'),
      () => '',
      'Priya',
      'priya@example.com'
    );

    expect(slots.map((slot) => [slot.key, slot.label])).toEqual([
      ['owner', 'Nishant'],
      ['4', 'Priya'],
      ['7', 'Arjun'],
    ]);
    expect(viewerSplitSlot(group)).toBe('4');
  });

  it('refuses to translate a default a member cannot express', () => {
    // The composer can only name the member's own friend rows, and a member has
    // none for the group's owner.
    expect(
      defaultSplitToComposerKeys(group, {
        payer: 'owner',
        tab: 'equally',
        participants: [{ slot: 'owner' }, { slot: '4' }],
      })
    ).toBeNull();
  });

  it('translates a default the owner can express into composer keys', () => {
    const ownerGroup = { ...group, viewer_role: 'owner', viewer_friend_id: null } as SplitGroup;

    expect(
      defaultSplitToComposerKeys(ownerGroup, {
        payer: 'owner',
        tab: 'percentages',
        participants: [
          { slot: 'owner', weight: '60' },
          { slot: '4', weight: '40' },
        ],
      })
    ).toEqual({
      payerKey: CURRENT_USER_KEY,
      participantKeys: [CURRENT_USER_KEY, '4'],
      weights: { [CURRENT_USER_KEY]: '60', '4': '40' },
    });
  });
});

/**
 * There is one delivery channel and it only reaches people who already use
 * Finnri: an in-app notification. No mail server, no SMS provider. So this
 * message has exactly one job — say which of the two happened, by name — and
 * the thing it must never do is let somebody believe a message went out when
 * nothing left the device.
 *
 * That belief is what the reported mess was built on: the person never turned
 * up, the owner added them again under a different address, and the ledger
 * ended up holding two of them.
 */
describe('describeMemberInvites', () => {
  it('says nothing when nobody was added', () => {
    expect(describeMemberInvites([])).toBeNull();
  });

  it('says who really was reached, and that they still have to accept', () => {
    // The one true delivery: they are on Finnri, so the invite is genuinely
    // sitting in their notifications.
    const message = describeMemberInvites([
      { friend_id: 4, name: 'Priya', status: 'notified' },
    ]);

    expect(message).toContain('Priya already uses Finnri');
    expect(message).toContain('waiting in their notifications');
    expect(message).toContain('they only see the group once they accept');
    // Nothing to share: the invite reached them, so the owner is not sent off
    // to do a job that is already done.
    expect(message).not.toContain('share an invite link');
  });

  it('never implies somebody was reached when they could not be', () => {
    const message = describeMemberInvites([
      { friend_id: 7, name: 'Flatmate', status: 'no_contact' },
    ]);

    expect(message).toContain('no email or phone saved');
    expect(message).toContain('share an invite link with them');
    expect(message).not.toContain('waiting in their notifications');
  });

  it('says outright that nothing is sent, whenever a link has to be shared', () => {
    // The sentence the whole mess turned on. Without it the user reasonably
    // assumes the address they typed is the address it went to.
    for (const status of ['invite_created', 'no_contact'] as const) {
      const message = describeMemberInvites([{ friend_id: 9, name: 'Arjun', status }]);

      expect(message).toContain('Finnri does not send emails or texts');
    }
  });

  it('separates people without an account from people without contact details', () => {
    const message = describeMemberInvites([
      { friend_id: 4, name: 'Priya', status: 'notified' },
      { friend_id: 7, name: 'Flatmate', status: 'no_contact' },
      { friend_id: 9, name: 'Arjun', status: 'invite_created' },
    ]);

    expect(message).toContain('Priya already uses Finnri');
    expect(message).toContain('Flatmate has no email or phone');
    expect(message).toContain('Arjun is not on Finnri yet');
    // The unreachable friend must not be listed twice under two headings.
    expect(message).not.toContain('Flatmate is not on Finnri yet');
  });
});

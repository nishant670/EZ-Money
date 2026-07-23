import { resolveSplitDraft } from '@/lib/split-draft';
import type { ParseResponse } from '@/lib/parse';
import type { SplitFriend, SplitGroup } from '@/lib/splits';

const baseParse = (overrides: Partial<ParseResponse>): ParseResponse => ({
  type: 'expense',
  title: 'Dinner',
  time: null,
  amount: 1200,
  currency: 'INR',
  mode: 'UPI',
  card_network: null,
  account_hint: null,
  category: 'Food',
  merchant: null,
  tag: null,
  note: null,
  date: '2026-07-21',
  source_text: 'dinner split',
  ...overrides,
});

describe('resolveSplitDraft', () => {
  it('matches existing friends without creating inline duplicates', () => {
    const friends = [{ id: 7, name: 'Riya', user_id: 1, archived: false }] as SplitFriend[];

    const draft = resolveSplitDraft(
      baseParse({
        split_candidate: true,
        split_candidate_details: {
          participants: [{ friend_name: 'riya', direction: 'friend_owes_user' }],
        },
      }),
      friends,
      []
    );

    expect(draft).toEqual(
      expect.objectContaining({
        splitEnabled: true,
        splitGroupId: null,
        splitParticipants: [
          {
            friendId: 7,
            friendName: '',
            shareAmount: '600.00',
            direction: 'friend_owes_user',
          },
        ],
      })
    );
  });

  it('matches an existing group and prefills equal member shares', () => {
    const groups = [
      {
        id: 4,
        name: 'Goa Trip',
        user_id: 1,
        archived: false,
        members: [
          { id: 1, user_id: 1, group_id: 4, friend_id: 11, friend: { id: 11, name: 'Aarav' } },
          { id: 2, user_id: 1, group_id: 4, friend_id: 12, friend: { id: 12, name: 'Meera' } },
        ],
      },
    ] as SplitGroup[];

    const draft = resolveSplitDraft(
      baseParse({
        amount: 1500,
        split_candidate: true,
        split_candidate_details: { group_name: 'goa trip', participants: [] },
      }),
      [],
      groups
    );

    expect(draft.splitGroupId).toBe(4);
    expect(draft.splitGroupName).toBe('');
    expect(draft.splitParticipants).toEqual([
      { friendId: 11, friendName: '', shareAmount: '500.00', direction: 'friend_owes_user' },
      { friendId: 12, friendName: '', shareAmount: '500.00', direction: 'friend_owes_user' },
    ]);
  });

  it('rebalances multiple parsed shares when AI assigns too much to each friend', () => {
    const friends = [
      { id: 1, name: 'Anshul', user_id: 1, archived: false },
      { id: 2, name: 'Riya', user_id: 1, archived: false },
      { id: 3, name: 'Nishant', user_id: 1, archived: false },
    ] as SplitFriend[];

    const draft = resolveSplitDraft(
      baseParse({
        amount: 2000,
        split_candidate: true,
        split_candidate_details: {
          participants: [
            { friend_name: 'Anshul', share_amount: 1000, direction: 'friend_owes_user' },
            { friend_name: 'Riya', share_amount: 1000, direction: 'friend_owes_user' },
            { friend_name: 'Nishant', share_amount: 1000, direction: 'friend_owes_user' },
          ],
        },
      }),
      friends,
      []
    );

    expect(draft.splitParticipants.map((participant) => participant.shareAmount)).toEqual([
      '500.00',
      '500.00',
      '500.00',
    ]);
  });
});

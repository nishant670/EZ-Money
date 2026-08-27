import { composerMemberKeys } from '@/components/split/split-utils';
import { computeSplitShares } from '@/lib/split-preferences';
import type { SplitFriend } from '@/lib/splits';

const friend = (id: number, name: string): SplitFriend =>
  ({ id, name, user_id: 1, archived: false }) as SplitFriend;

/** The lookup the composer's people list resolves through. */
const resolvable = (ids: number[]) => new Map(ids.map((id) => [id, friend(id, `Friend ${id}`)]));

describe('who the expense composer can put a row on screen for', () => {
  it('drops a member whose friend row is gone', () => {
    // The group still holds a membership row for a friend that was archived —
    // the server keeps membership and the friends list filters on `archived`,
    // so the two disagree about who is in the group.
    const members = [{ friend_id: 7 }, { friend_id: 9 }];

    expect(composerMemberKeys(members, resolvable([9]), [])).toEqual(['9']);
  });

  it('keeps every member it can resolve, once each', () => {
    const members = [{ friend_id: 7 }, { friend_id: 9 }, { friend_id: 7 }];

    expect(composerMemberKeys(members, resolvable([7, 9]), [])).toEqual(['7', '9']);
  });

  it('falls back to the friends list when there is no group', () => {
    // A bill with no group splits against whoever the user has.
    expect(composerMemberKeys(undefined, resolvable([]), [friend(3, 'Aarav')])).toEqual(['3']);
  });
});

/**
 * The bug this exists to stop, end to end.
 *
 * Two people are on screen at 60% and 40%. A third participant is in the
 * selection because the group still lists an archived friend as a member, and
 * it carries the 50 it was seeded with back when the split was two people. The
 * total reads 150% and there is no row to edit, because the row was filtered
 * out of the people list by the same lookup that should have filtered the key.
 */
describe('the 150% split', () => {
  const members = [{ friend_id: 7 }, { friend_id: 9 }];
  const weights = { me: '60.00', '9': '40.00', '7': '50.00' };

  const shares = (participantKeys: string[]) =>
    computeSplitShares({ amount: 1000, tab: 'percentages', keys: participantKeys, weights });

  it('is what an unfiltered member list produces', () => {
    // Every member key, archived or not — the old behaviour.
    const unfiltered = ['me', ...members.map((member) => String(member.friend_id))];
    const result = shares(unfiltered);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Percentages add up to 150.00%, not 100%.');
  });

  it('does not happen once the keys and the rows agree', () => {
    // Friend 7 is archived, so it is neither a row nor a key.
    const filtered = ['me', ...composerMemberKeys(members, resolvable([9]), [])];
    const result = shares(filtered);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shares).toEqual({ me: 600, '9': 400 });
  });
});

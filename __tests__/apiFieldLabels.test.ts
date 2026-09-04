import { formatApiFieldErrors } from '@/lib/api-error';

/**
 * The wall of text a merged duplicate used to produce under the Save button.
 *
 * The backend names fields by path, and title-casing one whole turned
 * `split.participants[0].friend_id` into "Split.Participants[0].Friend" — the
 * shape of a stack trace, about a person the user could see on screen.
 */
describe('api field labels', () => {
  it('reads an indexed path as a row the user filled in', () => {
    expect(
      formatApiFieldErrors({
        'split.participants[0].friend_id': 'must belong to this group',
      })
    ).toEqual(['Participant 1 friend must belong to this group.']);
  });

  it('counts rows from one, the way the list is drawn', () => {
    expect(
      formatApiFieldErrors({ 'split.participants[2].share_amount': 'must be positive' })
    ).toEqual(['Participant 3 share amount must be positive.']);
  });

  it("lets a caller's label match the leaf, since indices cannot be enumerated", () => {
    expect(
      formatApiFieldErrors(
        { 'split.participants[1].friend_id': 'must belong to this group' },
        { friend_id: 'Friend' }
      )
    ).toEqual(['Friend must belong to this group.']);
  });

  it('still labels a plain field exactly as before', () => {
    expect(formatApiFieldErrors({ total_amount: 'must be positive' })).toEqual([
      'Total Amount must be positive.',
    ]);
  });

  it('prefers an exact label over the generated one', () => {
    expect(
      formatApiFieldErrors({ 'split.group_id': 'must be a group you can access' }, {
        'split.group_id': 'Split group',
      })
    ).toEqual(['Split group must be a group you can access.']);
  });
});

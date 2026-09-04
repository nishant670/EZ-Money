import { zeroBalanceLabel } from '@/components/split/split-utils';

/**
 * A group created seconds ago read "settled up".
 *
 * That is a claim about what happened — money was owed and it came back — made
 * about a group where nothing has happened at all. It congratulates the user on
 * an event that never took place, and it takes the place of the one thing the
 * row should be prompting.
 */
describe('zeroBalanceLabel', () => {
  it('does not claim a settlement on a group with no expenses', () => {
    expect(zeroBalanceLabel({ hasActivity: false })).toBe('No expenses yet');
  });

  it('still says settled up when there was something to settle', () => {
    expect(zeroBalanceLabel({ hasActivity: true })).toBe('settled up');
  });

  it('makes the same distinction in the screen-wide figure', () => {
    expect(zeroBalanceLabel({ hasActivity: false, overall: true })).toBe(
      'Nothing to settle yet'
    );
    expect(zeroBalanceLabel({ hasActivity: true, overall: true })).toBe(
      'Overall, settled up'
    );
  });
});

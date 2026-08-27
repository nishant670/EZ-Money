import { countHiddenSettledGroups } from '@/components/split/split-utils';

type Summary = { group: { id: number }; netBalance: number };

const group = (id: number, netBalance: number): Summary => ({ group: { id }, netBalance });

const always = () => true;

describe('countHiddenSettledGroups', () => {
  /**
   * The bug this exists for. The Split screen keeps a freshly-made group on
   * screen under the `open` filter even though it is settled by definition —
   * otherwise a group vanishes the instant you create it. The hint used to
   * count settled groups on its own, so it counted that one too, and rendered
   * "Hiding groups that are settled up · Show 1 settled-up group" immediately
   * below the group it was naming.
   */
  it('does not count a settled group that is on screen', () => {
    const newEmptyGroup = group(1, 0);

    expect(countHiddenSettledGroups([newEmptyGroup], [newEmptyGroup], always)).toBe(0);
  });

  it('counts settled groups the filter is holding back', () => {
    const settledHidden = group(1, 0);
    const owing = group(2, -400);

    expect(countHiddenSettledGroups([settledHidden, owing], [owing], always)).toBe(1);
  });

  /** Under `all` nothing is held back, so there is nothing to offer to reveal. */
  it('counts nothing when every group is visible', () => {
    const summaries = [group(1, 0), group(2, 250), group(3, 0)];

    expect(countHiddenSettledGroups(summaries, summaries, always)).toBe(0);
  });

  /** An unsettled group is not what the "show settled-up groups" action reveals. */
  it('ignores hidden groups that are not settled', () => {
    const summaries = [group(1, 900), group(2, -50)];

    expect(countHiddenSettledGroups(summaries, [], always)).toBe(0);
  });

  /**
   * A group hidden by the search box is not hidden for being settled, and
   * switching the balance filter would not bring it back — so offering to is
   * a dead end.
   */
  it('ignores groups the search box is hiding', () => {
    const matching = group(1, 0);
    const filteredOut = group(2, 0);
    const matchesSearch = (summary: Summary) => summary.group.id === matching.group.id;

    expect(countHiddenSettledGroups([matching, filteredOut], [], matchesSearch)).toBe(1);
  });
});

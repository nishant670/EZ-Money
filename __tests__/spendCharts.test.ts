import type { DashboardCategory, DashboardDailySpend } from '@/lib/insights';
import {
  MAX_DAILY_BARS,
  MAX_NAMED_SLICES,
  buildDonutSlices,
  buildSpendBuckets,
  formatShare,
  ringSegmentPath,
} from '@/lib/spend-charts';

const day = (date: string, amount: number, count = amount > 0 ? 1 : 0): DashboardDailySpend => ({
  date,
  amount,
  count,
});

const range = (days: number, amount = 100): DashboardDailySpend[] =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(2026, 5, 1 + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    return day(iso, amount);
  });

const category = (
  name: string,
  amount: number,
  extra: Partial<DashboardCategory> = {}
): DashboardCategory => ({
  category: name,
  amount,
  percentage: 0,
  change: 0,
  ...extra,
});

describe('buildSpendBuckets', () => {
  it('keeps one bar per day, zero-spend days included', () => {
    // A dropped day and a ₹0 day look identical once the bar is gone, and a
    // gap in a spending chart is information.
    const buckets = buildSpendBuckets(
      [day('2026-08-01', 400), day('2026-08-02', 0), day('2026-08-03', 200)],
      200
    );

    expect(buckets.granularity).toBe('day');
    expect(buckets.buckets.map((bucket) => bucket.amount)).toEqual([400, 0, 200]);
    expect(buckets.buckets[1].label).toBe('2 Aug');
    expect(buckets.average).toBe(200);
    expect(buckets.averageLabel).toBe('per day');
  });

  it('groups into weeks once a period is too long to tap', () => {
    // 92 daily bars is three pixels each. Requirement three of this feature is
    // that a bar can be tapped, so past the daily cap they become weeks.
    const buckets = buildSpendBuckets(range(35, 100), 100);

    expect(buckets.granularity).toBe('week');
    expect(buckets.bucketDays).toBe(7);
    expect(buckets.buckets).toHaveLength(5);
    expect(buckets.buckets[0]).toMatchObject({ amount: 700, days: 7, count: 7 });
    // The reference line has to be an average bucket, not an average day, or a
    // weekly chart would sit entirely above its own line.
    expect(buckets.average).toBe(700);
    expect(buckets.averageLabel).toBe('per week');
  });

  it('stays daily right up to the cap', () => {
    expect(buildSpendBuckets(range(MAX_DAILY_BARS), 0).granularity).toBe('day');
    expect(buildSpendBuckets(range(MAX_DAILY_BARS + 1), 0).granularity).toBe('week');
  });

  it('leaves a short trailing week short rather than padding it', () => {
    const buckets = buildSpendBuckets(range(33, 100), 100);
    const last = buckets.buckets[buckets.buckets.length - 1];

    expect(last.days).toBe(5);
    expect(last.amount).toBe(500);
    // The bucket's own range is what the transaction list gets filtered to, so
    // it must not claim days the period does not have.
    expect(last.start).toBe('2026-06-29');
    expect(last.end).toBe('2026-07-03');
  });

  it('carries the filter that reproduces each bar', () => {
    const [first] = buildSpendBuckets([day('2026-08-04', 250)], 250).buckets;
    expect(first.start).toBe('2026-08-04');
    expect(first.end).toBe('2026-08-04');
  });
});

describe('buildDonutSlices', () => {
  it('charts every category, not the top two', () => {
    // The ring this replaces drew the single largest category and printed its
    // share in the middle.
    const slices = buildDonutSlices(
      [
        category('Bills', 400),
        category('Food & Drinks', 300),
        category('Transport', 200),
        category('Shopping', 100),
      ],
      1000
    );

    expect(slices.map((slice) => slice.label)).toEqual([
      'Bills',
      'Food & Drinks',
      'Transport',
      'Shopping',
    ]);
    expect(slices.map((slice) => slice.percentage)).toEqual([40, 30, 20, 10]);
  });

  it('adds up to the total printed in the centre', () => {
    const slices = buildDonutSlices([category('Bills', 400), category('Misc', 100)], 1000);
    const charted = slices.reduce((sum, slice) => sum + slice.amount, 0);

    // ₹500 of the ₹1,000 is not in the breakdown at all — the backend caps what
    // it sends. The residual has to be on the ring or the ring lies about the
    // number in its middle.
    expect(charted).toBe(1000);
    expect(slices[slices.length - 1]).toMatchObject({ label: 'Other', amount: 500, category: null });
  });

  it('rolls up slivers and names what it swept up', () => {
    // 2.5% and 1.5% — both under the share a slice needs to be readable.
    const slices = buildDonutSlices(
      [category('Bills', 960), category('Misc', 25), category('Travel', 15)],
      1000
    );

    const other = slices[slices.length - 1];
    expect(other.label).toBe('Other');
    expect(other.amount).toBe(40);
    expect(other.rolledUp.map((item) => item.category)).toEqual(['Misc', 'Travel']);
  });

  it('never hides a single category behind the word Other', () => {
    // A rollup of exactly one known category is that category. Calling it
    // "Other" would throw away a name we have.
    const slices = buildDonutSlices([category('Bills', 980), category('Misc', 20)], 1000);

    expect(slices.map((slice) => slice.label)).toEqual(['Bills', 'Misc']);
    expect(slices[1].category).toBe('Misc');
  });

  it('caps how many slices get their own name', () => {
    const many = Array.from({ length: 12 }, (_, index) => category(`Cat ${index}`, 100));
    const slices = buildDonutSlices(many, 1200);

    expect(slices).toHaveLength(MAX_NAMED_SLICES + 1);
    expect(slices[slices.length - 1].label).toBe('Other');
  });

  it('lays the slices around the ring without gaps or overlap', () => {
    const slices = buildDonutSlices(
      [category('Bills', 500), category('Food & Drinks', 300), category('Transport', 200)],
      1000
    );

    expect(slices[0].startFraction).toBe(0);
    slices.forEach((slice, index) => {
      if (index > 0) expect(slice.startFraction).toBeCloseTo(slices[index - 1].endFraction, 10);
    });
    expect(slices[slices.length - 1].endFraction).toBeCloseTo(1, 10);
  });

  it('only carries a comparison the backend judged comparable', () => {
    // S5's floor. A percentage over a near-empty baseline is the four-digit
    // nonsense that made this tab unbelievable.
    const [comparable, thin] = buildDonutSlices(
      [
        category('Bills', 600, { change: 91, change_comparable: true }),
        category('Travel', 400, { change: 2683, change_comparable: false }),
      ],
      1000
    );

    expect(comparable.change).toBe(91);
    expect(thin.change).toBeNull();
  });

  it('has nothing to chart when nothing was spent', () => {
    expect(buildDonutSlices([category('Bills', 0)], 0)).toEqual([]);
  });
});

describe('formatShare', () => {
  it('never rounds a real amount down to nothing', () => {
    // ₹320 across a quarter is 0.24%. "0% · ₹320" reads as a broken sum.
    expect(formatShare(0.24)).toBe('<1%');
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(49.2)).toBe('49%');
  });
});

describe('ringSegmentPath', () => {
  it('draws a ring rather than collapsing when one category is everything', () => {
    // A full-turn arc has identical endpoints and disappears, which is exactly
    // what a single-category period asks for.
    const path = ringSegmentPath(50, 40, 20, 0, 1);

    expect(path).not.toBe('');
    expect(path).toContain('A 40 40');
    expect(path.trim().endsWith('Z')).toBe(true);
  });

  it('flags the long way round past a half turn', () => {
    expect(ringSegmentPath(50, 40, 20, 0, 0.25)).toContain('A 40 40 0 0 1');
    expect(ringSegmentPath(50, 40, 20, 0, 0.75)).toContain('A 40 40 0 1 1');
  });

  it('draws nothing for an empty slice', () => {
    expect(ringSegmentPath(50, 40, 20, 0.5, 0.5)).toBe('');
  });
});

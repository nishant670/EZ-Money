import { CATEGORY_VISUALS, categoryVisual, type CategoryVisual } from './categories';
import type { DashboardCategory, DashboardDailySpend } from './insights';

/**
 * The arithmetic behind the Insights charts, kept out of the components so it
 * can be tested without rendering anything.
 *
 * Two rules run through all of it:
 *
 * 1. **Every rupee in the period is on the chart.** The bars cover every day in
 *    the range, zero-spend days included, because a missing day and a ₹0 day
 *    look identical once they are dropped. The donut adds an `Other` slice
 *    built from the residual, so the ring always sums to the total printed in
 *    its centre.
 * 2. **A tap has to mean something.** Every bucket and every slice carries the
 *    filter that reproduces it in the transaction list — a date range or a
 *    category — so the chart can hand that straight to the list rather than
 *    each caller re-deriving it.
 */

/** A day is only worth its own bar while the bars stay wide enough to hit. */
export const MAX_DAILY_BARS = 31;

const parseIsoDay = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(day.getTime()) ? null : day;
};

const shortDay = (value: string) => {
  const day = parseIsoDay(value);
  if (!day) return value;
  return `${day.getDate()} ${day.toLocaleString('en-US', { month: 'short' })}`;
};

export type SpendBucket = {
  /** First day covered, `YYYY-MM-DD`. Also the filter's `start_date`. */
  start: string;
  /** Last day covered, inclusive. Also the filter's `end_date`. */
  end: string;
  /** Days actually covered — a trailing week bucket is usually short. */
  days: number;
  amount: number;
  count: number;
  /** What the bar is called when it is selected: `12 Aug` or `6 Aug – 12 Aug`. */
  label: string;
  /** The tick under the axis. Deliberately terser than `label`. */
  axisLabel: string;
};

export type SpendBuckets = {
  buckets: SpendBucket[];
  /** 1 for daily bars, 7 for weekly ones. */
  bucketDays: number;
  granularity: 'day' | 'week';
  /** The reference line: what an average bucket holds. */
  average: number;
  /** `Avg ₹412/day`, phrased for whichever granularity won. */
  averageLabel: string;
  max: number;
  total: number;
};

/**
 * Daily bars, or weekly ones once a period is too long to hit with a thumb.
 *
 * "Last 3 Months" is ~92 days. Ninety-two bars across a phone-width card is
 * three pixels each — legible as a shape, impossible to tap, and requirement
 * three of this feature is that tapping a bar filters the list. So past
 * {@link MAX_DAILY_BARS} the days are grouped into weeks from the start of the
 * range. Grouping from the start rather than from Monday keeps the first bucket
 * whole; it is the last one that comes up short, and it says so.
 */
export const buildSpendBuckets = (
  daily: DashboardDailySpend[],
  dailyAverage: number
): SpendBuckets => {
  const days = daily.filter((day) => Boolean(parseIsoDay(day.date)));
  const granularity: 'day' | 'week' = days.length > MAX_DAILY_BARS ? 'week' : 'day';
  const bucketDays = granularity === 'week' ? 7 : 1;

  const buckets: SpendBucket[] = [];
  for (let index = 0; index < days.length; index += bucketDays) {
    const window = days.slice(index, index + bucketDays);
    const start = window[0].date;
    const end = window[window.length - 1].date;
    const amount = window.reduce((sum, day) => sum + (day.amount || 0), 0);
    const count = window.reduce((sum, day) => sum + (day.count || 0), 0);
    buckets.push({
      start,
      end,
      days: window.length,
      amount,
      count,
      label: start === end ? shortDay(start) : `${shortDay(start)} – ${shortDay(end)}`,
      axisLabel: shortDay(start),
    });
  }

  // The backend's daily average is total ÷ days in range, and the bars cover
  // exactly those days — so the line for a weekly chart is that average times
  // a full week, and a short trailing bucket sits under it for a reason the
  // selection panel states rather than hides.
  const average = Math.max(0, dailyAverage) * bucketDays;

  return {
    buckets,
    bucketDays,
    granularity,
    average,
    averageLabel: granularity === 'week' ? 'per week' : 'per day',
    max: buckets.reduce((highest, bucket) => Math.max(highest, bucket.amount), 0),
    total: buckets.reduce((sum, bucket) => sum + bucket.amount, 0),
  };
};

/** Named slices stop here; everything after is rolled up. */
export const MAX_NAMED_SLICES = 7;
/** A slice thinner than this is a sliver nobody can read or hit. */
export const MIN_SLICE_SHARE = 3;

const OTHER_LABEL = 'Other';

export const OTHER_VISUAL: CategoryVisual = {
  icon: 'dots-horizontal-circle-outline',
  color: '#B0AEB8',
  bgColor: '#F1F0F4',
};

export type DonutSlice = {
  label: string;
  amount: number;
  /** Share of the period total, so the slices sum to 100. */
  percentage: number;
  color: string;
  /** Null for the rollup — `Other` is not a category and cannot be filtered. */
  category: string | null;
  /**
   * Percent change against the window the backend compared to, carried through
   * only when it cleared S5's floor. `Other` never has one: a change across a
   * shifting set of categories is not a change in anything.
   */
  change: number | null;
  /** What the rollup swept up, so tapping it can say what is inside. */
  rolledUp: { category: string; amount: number; percentage: number }[];
  /**
   * Where the slice sits on the ring, as fractions of a turn from twelve
   * o'clock. Accumulated here rather than in the component so the arcs are
   * decided once, in the same place the shares are.
   */
  startFraction: number;
  endFraction: number;
};

/**
 * The donut, as slices.
 *
 * The old ring charted the top two categories and printed `Bills 49%` in the
 * middle, so it read as a progress meter towards an unstated goal. This charts
 * the whole period: named slices down to {@link MIN_SLICE_SHARE}, capped at
 * {@link MAX_NAMED_SLICES}, and one `Other` holding the rest.
 *
 * `Other` is the residual against `totalSpent`, not the sum of what was swept
 * up — the backend caps the breakdown it sends, so a long tail can fall off the
 * end of the list entirely. Deriving it from the total means the ring still
 * adds up to the figure in its centre either way, and `rolledUp` names only the
 * part we can actually name.
 */
export const buildDonutSlices = (
  categories: DashboardCategory[],
  totalSpent: number
): DonutSlice[] => withRingPositions(buildSlices(categories, totalSpent));

/** Lays the finished slices out around the ring, in order, without gaps. */
const withRingPositions = (slices: DonutSlice[]): DonutSlice[] => {
  let cursor = 0;
  return slices.map((slice) => {
    const startFraction = cursor;
    cursor += slice.percentage / 100;
    return { ...slice, startFraction, endFraction: cursor };
  });
};

const buildSlices = (categories: DashboardCategory[], totalSpent: number): DonutSlice[] => {
  const total = Math.max(0, totalSpent);
  if (total <= 0) return [];

  const ranked = [...categories]
    .filter((category) => category.amount > 0)
    .sort((first, second) => second.amount - first.amount);

  const share = (amount: number) => (amount / total) * 100;

  const named: DashboardCategory[] = [];
  const rolled: DashboardCategory[] = [];
  ranked.forEach((category) => {
    if (named.length < MAX_NAMED_SLICES && share(category.amount) >= MIN_SLICE_SHARE) {
      named.push(category);
    } else {
      rolled.push(category);
    }
  });

  const residual = total - named.reduce((sum, category) => sum + category.amount, 0);

  const namedSlice = (category: DashboardCategory): DonutSlice => ({
    label: category.category,
    amount: category.amount,
    percentage: share(category.amount),
    color: categoryVisual(category.category).color,
    category: category.category,
    change: category.change_comparable ? category.change : null,
    rolledUp: [],
    startFraction: 0,
    endFraction: 0,
  });

  const slices: DonutSlice[] = named.map(namedSlice);

  // Rounding aside, a residual this small is not a slice — it is noise, and a
  // hairline "Other" wedge next to the categories it is not is worse than
  // leaving it off.
  if (residual <= 0.5) return slices;

  // A rollup holding exactly one known category, and nothing unaccounted for,
  // is that category. Calling it "Other" would hide a name we have.
  if (rolled.length === 1 && Math.abs(residual - rolled[0].amount) <= 0.5) {
    slices.push(namedSlice(rolled[0]));
    return slices;
  }

  slices.push({
    label: OTHER_LABEL,
    amount: residual,
    percentage: share(residual),
    color: OTHER_VISUAL.color,
    category: null,
    change: null,
    rolledUp: rolled.map((category) => ({
      category: category.category,
      amount: category.amount,
      percentage: share(category.amount),
    })),
    startFraction: 0,
    endFraction: 0,
  });
  return slices;
};

/**
 * The SVG path for one ring segment, drawn clockwise from twelve o'clock.
 *
 * Angles arrive as fractions of the circle (0–1) rather than radians, because
 * that is what a share of the total already is.
 */
export const ringSegmentPath = (
  centre: number,
  outerRadius: number,
  innerRadius: number,
  startFraction: number,
  endFraction: number
): string => {
  // A full-circle arc has identical endpoints and collapses to nothing, which
  // is exactly what a single-category period would ask for. A sliver short of
  // the full turn draws the same ring and cannot degenerate.
  const sweep = Math.min(Math.max(endFraction - startFraction, 0), 0.9999);
  if (sweep <= 0) return '';

  const point = (radius: number, fraction: number) => {
    const angle = fraction * Math.PI * 2 - Math.PI / 2;
    return [centre + radius * Math.cos(angle), centre + radius * Math.sin(angle)];
  };

  const end = startFraction + sweep;
  const largeArc = sweep > 0.5 ? 1 : 0;
  const [outerStartX, outerStartY] = point(outerRadius, startFraction);
  const [outerEndX, outerEndY] = point(outerRadius, end);
  const [innerEndX, innerEndY] = point(innerRadius, end);
  const [innerStartX, innerStartY] = point(innerRadius, startFraction);

  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}`,
    'Z',
  ].join(' ');
};

/**
 * A slice's share, as a label.
 *
 * Rounding is not allowed to reach zero: over a quarter's spending a real ₹320
 * is 0.24%, and a legend row reading "0% · ₹320" looks like a broken sum rather
 * than a small number.
 */
export const formatShare = (percentage: number): string => {
  if (percentage > 0 && percentage < 1) return '<1%';
  return `${Math.round(percentage)}%`;
};

/** Kept beside the slice builder so a category can never chart without one. */
export const sliceVisual = (category: string | null) =>
  category ? categoryVisual(category) : OTHER_VISUAL;

/** Exported for the drift test that pins slice colours to the canonical map. */
export const CATEGORY_COLOURS = CATEGORY_VISUALS;

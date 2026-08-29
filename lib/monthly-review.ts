import { getClientTimeZone } from './datetime';
import { readApiError } from './api-error';
import {
  formatChangeMagnitude,
  type DashboardCategory,
  type DashboardMerchant,
  type DashboardSummary,
} from './insights';
import { formatMoney } from './money';
import { API_BASE_URL } from './transactions';

export type MonthlyReviewDay = {
  date: string;
  amount: number;
  count: number;
};

export type MonthlyReviewChange = {
  category: string;
  amount: number;
  previous_amount: number;
  /** Only meaningful when `comparable` is true. */
  change: number;
  comparable: boolean;
  direction: 'higher' | 'lower';
};

export type MonthlyReview = {
  month: string;
  /** "August 2026" — a month name, so the server writes it. Money never is. */
  label: string;
  previous_label: string;
  start_date: string;
  end_date: string;
  /** False when the month held too little to describe. */
  available: boolean;
  summary: DashboardSummary;
  top_categories: DashboardCategory[];
  top_merchants: DashboardMerchant[];
  daily_spending: MonthlyReviewDay[];
  biggest_change: MonthlyReviewChange | null;
  busiest_day: MonthlyReviewDay | null;
  notified_at?: string;
};

export const fetchMonthlyReview = async (
  token: string,
  month?: string,
  tz: string = getClientTimeZone()
): Promise<MonthlyReview> => {
  const params = new URLSearchParams({ tz });
  if (month) params.set('month', month);

  const response = await fetch(`${API_BASE_URL}/v1/monthly-review?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to load this month’s review.');
  }
  return response.json();
};

/**
 * Fires this user's own review notification for the completed month.
 *
 * Idempotent: the month is claimed by a unique index, so a second call sends
 * nothing and reports `sent: false`.
 */
export const sendMonthlyReviewNow = async (
  token: string
): Promise<{ month: string; sent: boolean }> => {
  const response = await fetch(`${API_BASE_URL}/v1/monthly-review/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to send the review notification.');
  }
  return response.json();
};

/** `/monthly-review/2026-08` → `2026-08`. */
export const monthFromActionURL = (actionURL?: string) =>
  actionURL?.match(/^\/monthly-review\/(\d{4}-\d{2})$/)?.[1] ?? null;

/**
 * How the month compares to the one before it, in words — or nothing at all.
 *
 * `spend_change_comparable` is read first and on purpose. When the previous
 * month was too thin to divide by the server sends 0, and "0% vs July" reads as
 * "you spent exactly the same", which is a claim nobody made.
 */
export const describeMonthlyChange = (review: MonthlyReview) => {
  if (!review.summary.spend_change_comparable) return null;
  const change = review.summary.spend_change ?? 0;
  return `${formatChangeMagnitude(change)} ${change < 0 ? 'under' : 'over'} ${review.previous_label}`;
};

/**
 * The share text.
 *
 * Composed here rather than on the server so every amount goes through
 * `formatMoney` like every other amount in the app — the server writes the
 * notification's copy only because no client is running when that job fires.
 *
 * It is text rather than an image on purpose. An image is the more shareable
 * artefact, and rendering one needs `react-native-view-shot`, which ships
 * native code: a new dev client and a release build before anyone could look at
 * the output. That is the trade C9 declined for shared element transitions and
 * M6 declined for `expo-print`, for the same reason — it makes the work
 * unverifiable on the handset that is already attached.
 */
export const monthlyReviewShareText = (review: MonthlyReview) => {
  const lines = [`${review.label} on Finnri`, ''];

  const comparison = describeMonthlyChange(review);
  // The count has to be the rows the total is made of, so it reads the expense
  // count and not every entry in the month. Older responses may not carry it.
  const spentAcross = review.summary.expense_count ?? review.summary.transaction_count;
  lines.push(
    `Spent ${formatMoney(review.summary.total_spent)} across ${spentAcross} transaction${
      spentAcross === 1 ? '' : 's'
    }${comparison ? ` — ${comparison}` : ''}.`
  );

  if (review.summary.total_income > 0) {
    const net = review.summary.total_income - review.summary.total_spent;
    lines.push(
      `Earned ${formatMoney(review.summary.total_income)}, ${net >= 0 ? 'kept' : 'over by'} ${formatMoney(
        Math.abs(net)
      )}.`
    );
  }

  const top = review.top_categories.slice(0, 3);
  if (top.length > 0) {
    lines.push('');
    lines.push('Where it went:');
    top.forEach((category) => {
      lines.push(`· ${category.category} — ${formatMoney(category.amount)}`);
    });
  }

  if (review.biggest_change) {
    const { category, direction, comparable, change } = review.biggest_change;
    lines.push('');
    lines.push(
      comparable
        ? `Biggest change: ${category}, ${formatChangeMagnitude(change)} ${direction}.`
        : `Biggest change: ${category}.`
    );
  }

  return lines.join('\n');
};

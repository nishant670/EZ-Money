import type { Transaction } from '@/types/transaction';

/**
 * One tap of context for the amount-first entry sheet.
 *
 * A `merchant` fill is a whole transaction shape the user has already used —
 * title, merchant, category, payment mode and account together — so repeating
 * yesterday's chai costs one tap plus the amount. A `category` fill carries
 * only the category: it exists for the first week of a new account, when there
 * is nothing to repeat yet, and it deliberately does not touch the payment
 * mode or account, because guessing those from an unrelated entry would be
 * surprising rather than fast.
 */
export type QuickFill = {
  key: string;
  label: string;
  kind: 'merchant' | 'category';
  category: string;
  title?: string;
  merchant?: string;
  mode?: string;
  accountId?: number | null;
  accountName?: string;
};

const DEFAULT_LIMIT = 6;

/**
 * How far back to look. Ranking is by how often something recurs, so the
 * window has to hold more than a handful of rows — but reaching months back
 * would let a merchant nobody has used since April outrank this week's.
 */
const CANDIDATE_WINDOW = 60;

type Bucket = {
  fill: QuickFill;
  count: number;
  /** Index of the newest occurrence — the tie-break when counts are equal. */
  rank: number;
};

/**
 * The chip row above the keypad, most-repeated first.
 *
 * `transactions` is expected newest-first, which is what `loadTransactions`
 * returns. The payload comes from the newest occurrence of each label, so a
 * merchant that moved from Cash to UPI fills with UPI.
 */
export const buildQuickFills = (
  transactions: Transaction[],
  type: string,
  limit: number = DEFAULT_LIMIT
): QuickFill[] => {
  const wantedType = type?.toLowerCase() === 'income' ? 'income' : 'expense';
  const candidates = transactions
    .filter((transaction) => (transaction.entryType ?? 'expense') === wantedType)
    .slice(0, CANDIDATE_WINDOW);

  const byLabel = new Map<string, Bucket>();
  candidates.forEach((transaction, index) => {
    const merchant = transaction.merchant?.trim() ?? '';
    const label = merchant || transaction.title?.trim() || '';
    if (!label) {
      return;
    }
    const key = label.toLowerCase();
    const existing = byLabel.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    byLabel.set(key, {
      count: 1,
      rank: index,
      fill: {
        key: `merchant:${key}`,
        label,
        kind: 'merchant',
        title: transaction.title?.trim() || label,
        merchant,
        category: transaction.category,
        mode: transaction.mode ?? undefined,
        accountId: transaction.accountId ?? null,
        accountName: transaction.accountName ?? '',
      },
    });
  });

  const merchantFills = Array.from(byLabel.values())
    .sort((a, b) => b.count - a.count || a.rank - b.rank)
    .slice(0, limit)
    .map((bucket) => bucket.fill);

  if (merchantFills.length >= limit) {
    return merchantFills;
  }

  // Fill the rest of the row with categories the merchant chips do not already
  // cover, so an empty-ish history still offers something to tap.
  const covered = new Set(merchantFills.map((fill) => fill.category.toLowerCase()));
  const categoryFills: QuickFill[] = [];
  candidates.forEach((transaction) => {
    const category = transaction.category?.trim();
    if (!category) {
      return;
    }
    const key = category.toLowerCase();
    if (covered.has(key)) {
      return;
    }
    covered.add(key);
    categoryFills.push({
      key: `category:${key}`,
      label: category,
      kind: 'category',
      category,
    });
  });

  return [...merchantFills, ...categoryFills].slice(0, limit);
};

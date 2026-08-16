import { router } from 'expo-router';

/**
 * The one place that knows how to point the transaction list at a subset.
 *
 * The Insights charts are only worth tapping if the tap lands somewhere that
 * proves the bar or the slice: the transactions behind it. That means the list
 * has to accept a filter as route params, and both ends have to agree on their
 * names — so both ends read them from here rather than each spelling out
 * `start_date` and hoping.
 */

export type TransactionFilterLink = {
  category?: string;
  /**
   * The list's free-text search, which spans title, merchant and notes.
   * A merchant answer ("₹1,900 at Swiggy this month") is computed with this
   * predicate, so it has to travel with the tap-through or the list would open
   * on more rows than the number counted.
   */
  q?: string;
  mode?: string;
  /** Inclusive `YYYY-MM-DD` bounds. */
  startDate?: string;
  endDate?: string;
  /**
   * Both charts plot expenses only. Without this a day's bar of ₹800 opens a
   * list also holding that day's ₹50,000 salary, and the list contradicts the
   * chart that opened it.
   */
  type?: 'Expense' | 'Income';
};

export const openFilteredTransactions = (filter: TransactionFilterLink) => {
  router.push({
    pathname: '/transactions',
    params: {
      category: filter.category ?? undefined,
      q: filter.q ?? undefined,
      mode: filter.mode ?? undefined,
      start_date: filter.startDate ?? undefined,
      end_date: filter.endDate ?? undefined,
      type: filter.type ?? undefined,
    },
  });
};

/**
 * The parse channel's answers arrive already carrying the API's own query
 * parameters, because that is what they were computed over. This is the one
 * place that turns them back into a route, so the mapping lives beside the
 * mapping it has to agree with.
 */
export const openAnswerTransactions = (filters: Record<string, string>) => {
  const type = filters.type?.toLowerCase();
  openFilteredTransactions({
    category: filters.category || undefined,
    q: filters.q || undefined,
    mode: filters.mode || undefined,
    startDate: filters.start_date || undefined,
    endDate: filters.end_date || undefined,
    type: type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : undefined,
  });
};

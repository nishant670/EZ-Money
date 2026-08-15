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
      start_date: filter.startDate ?? undefined,
      end_date: filter.endDate ?? undefined,
      type: filter.type ?? undefined,
    },
  });
};

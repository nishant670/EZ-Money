import {
  isAmountSort,
  loadTransactionPage,
  loadTransactions,
} from '@/lib/transactions';
import { PAYMENT_MODES, resolvePaymentMode } from '@/lib/payment-modes';

const entry = (id: number, title: string, amount: number, date: string) => ({
  id,
  title,
  amount,
  date,
  type: 'expense',
  mode: 'Cash',
  category: 'Misc',
});

const respondWith = (body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as typeof fetch;
};

const lastRequestUrl = () => (global.fetch as jest.Mock).mock.calls[0][0] as string;

describe('loadTransactionPage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the order the server returned', async () => {
    // The rent row is the biggest and the oldest. This used to re-sort every
    // response by date on the way in, which would put Metro first and leave a
    // list that claims to be ranked by amount and is not.
    respondWith({
      entries: [
        entry(1, 'Rent', 18000, '2026-07-01'),
        entry(2, 'Metro', 90, '2026-07-30'),
        entry(3, 'Chai', 20, '2026-07-15'),
      ],
      total: 3,
    });

    const page = await loadTransactionPage('token', { sort: 'highest' });

    expect(page.transactions.map((transaction) => transaction.name)).toEqual([
      'Rent',
      'Metro',
      'Chai',
    ]);
    expect(lastRequestUrl()).toContain('sort=highest');
  });

  it('carries the facet counts back with the page', async () => {
    respondWith({
      entries: [entry(1, 'Chai', 20, '2026-07-15')],
      total: 1,
      category_counts: { 'Food & Drinks': 2, Transport: 1 },
    });

    const page = await loadTransactionPage('token');

    expect(page.categoryCounts).toEqual({ 'Food & Drinks': 2, Transport: 1 });
  });

  it('reports the whole match count, not the page length', async () => {
    respondWith({ entries: [entry(1, 'Chai', 20, '2026-07-15')], total: 154 });

    expect((await loadTransactionPage('token')).total).toBe(154);
  });

  it('survives an older response with no counts', async () => {
    respondWith({ entries: [entry(1, 'Chai', 20, '2026-07-15')] });

    const page = await loadTransactionPage('token');

    expect(page.categoryCounts).toEqual({});
    expect(page.total).toBe(1);
  });

  it('sends no query string at all when nothing is filtered', async () => {
    respondWith({ entries: [], total: 0 });

    await loadTransactionPage('token', { type: undefined, category: undefined });

    expect(lastRequestUrl()).not.toContain('?');
  });
});

describe('loadTransactions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('still hands its callers a newest-first feed', async () => {
    // Home and the dashboards assume chronological order regardless of what the
    // server did, so this wrapper keeps sorting even though the page does not.
    respondWith({
      entries: [
        entry(1, 'Rent', 18000, '2026-07-01'),
        entry(2, 'Metro', 90, '2026-07-30'),
      ],
      total: 2,
    });

    const transactions = await loadTransactions('token');

    expect(transactions.map((transaction) => transaction.name)).toEqual(['Metro', 'Rent']);
  });
});

describe('isAmountSort', () => {
  it('is what decides whether the list keeps its day sections', () => {
    expect(isAmountSort('newest')).toBe(false);
    expect(isAmountSort('oldest')).toBe(false);
    expect(isAmountSort('highest')).toBe(true);
    expect(isAmountSort('lowest')).toBe(true);
  });
});

describe('payment modes', () => {
  it('includes the mode the filter sheet used to omit', () => {
    expect(PAYMENT_MODES).toContain('Bank Account');
  });

  it('does not recognise Debit Card, which the sheet used to offer', () => {
    // Nine rows use Bank Account; none use Debit Card. Aliasing one onto the
    // other would invent a meaning rather than recover one.
    expect(resolvePaymentMode('Debit Card')).toBeNull();
    expect(resolvePaymentMode('bank')).toBe('Bank Account');
    expect(resolvePaymentMode('UPI')).toBe('UPI');
    expect(resolvePaymentMode('')).toBeNull();
  });
});

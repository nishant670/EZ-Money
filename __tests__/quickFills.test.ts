import { buildQuickFills } from '@/lib/quick-fills';
import type { Transaction } from '@/types/transaction';

const entry = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
  name: 'Entry',
  category: 'Food & Drinks',
  amount: -100,
  icon: 'silverware-fork-knife',
  section: 'Today',
  entryType: 'expense',
  ...overrides,
});

describe('buildQuickFills', () => {
  it('ranks by how often a merchant repeats, not by how recent it is', () => {
    const fills = buildQuickFills(
      [
        entry({ id: '1', merchant: 'Blue Tokai', category: 'Food & Drinks' }),
        entry({ id: '2', merchant: 'DMart', category: 'Shopping' }),
        entry({ id: '3', merchant: 'DMart', category: 'Shopping' }),
      ],
      'Expense'
    );

    expect(fills.map((fill) => fill.label)).toEqual(['DMart', 'Blue Tokai']);
  });

  it('carries the newest occurrence of a merchant, so a moved account wins', () => {
    const [fill] = buildQuickFills(
      [
        entry({
          id: '2',
          title: 'Metro card',
          merchant: 'Metro',
          category: 'Transport',
          mode: 'UPI',
          accountId: 7,
          accountName: 'HDFC UPI',
        }),
        entry({
          id: '1',
          title: 'Metro card',
          merchant: 'Metro',
          category: 'Transport',
          mode: 'Cash',
          accountId: 3,
          accountName: 'Cash',
        }),
      ],
      'Expense'
    );

    expect(fill).toEqual(
      expect.objectContaining({
        kind: 'merchant',
        label: 'Metro',
        title: 'Metro card',
        category: 'Transport',
        mode: 'UPI',
        accountId: 7,
        accountName: 'HDFC UPI',
      })
    );
  });

  it('falls back to the title when there is no merchant', () => {
    const fills = buildQuickFills(
      [entry({ id: '1', title: 'Chai', merchant: null, category: 'Food & Drinks' })],
      'Expense'
    );

    expect(fills[0]).toEqual(expect.objectContaining({ label: 'Chai', title: 'Chai' }));
  });

  it('only offers fills matching the entry type', () => {
    const fills = buildQuickFills(
      [
        entry({ id: '1', merchant: 'Salary', category: 'Misc', entryType: 'income' }),
        entry({ id: '2', merchant: 'DMart', category: 'Shopping' }),
      ],
      'Income'
    );

    expect(fills.map((fill) => fill.label)).toEqual(['Salary']);
  });

  it('pads the row with categories the merchant chips do not already cover', () => {
    const fills = buildQuickFills(
      [
        entry({ id: '1', merchant: 'DMart', category: 'Shopping' }),
        entry({ id: '2', merchant: null, title: null, category: 'Bills' }),
        entry({ id: '3', merchant: null, title: null, category: 'Shopping' }),
      ],
      'Expense'
    );

    expect(fills).toEqual([
      expect.objectContaining({ kind: 'merchant', label: 'DMart' }),
      expect.objectContaining({ kind: 'category', label: 'Bills' }),
    ]);
  });

  it('leaves the payment mode and account alone on a category chip', () => {
    const [fill] = buildQuickFills(
      [entry({ id: '1', merchant: null, title: null, category: 'Bills', mode: 'UPI', accountId: 4 })],
      'Expense'
    );

    expect(fill.kind).toBe('category');
    expect(fill.mode).toBeUndefined();
    expect(fill.accountId).toBeUndefined();
  });

  it('returns nothing for an account with no history', () => {
    expect(buildQuickFills([], 'Expense')).toEqual([]);
  });
});

import type { Account } from '@/lib/accounts';
import type { Subscription } from '@/lib/subscriptions';
import {
  buildUpcomingDues,
  formatDueLabel,
  nextCardDueDate,
  totalUpcomingAmount,
} from '@/lib/upcoming';

const subscription = (overrides: Partial<Subscription>): Subscription =>
  ({
    id: 1,
    user_id: 1,
    name: 'Netflix',
    merchant: 'Netflix',
    category: 'Entertainment',
    amount: 499,
    currency: 'INR',
    billing_interval: 'monthly',
    next_due_date: '2026-08-20',
    status: 'active',
    reminder_days: 3,
    cancel_before_due: false,
    autopay: false,
    payment_mode: 'UPI',
    transaction_tag: '',
    purpose_type: '',
    notes: '',
    days_until_due: 8,
    due_state: 'scheduled',
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as Subscription;

const card = (overrides: Partial<Account>): Account =>
  ({
    id: 10,
    type: 'credit_card',
    name: 'HDFC Regalia',
    color: '#8257E5',
    due_day: 15,
    summary: { outstanding: 12000 },
    ...overrides,
  }) as Account;

const today = new Date(2026, 7, 12); // 12 Aug 2026

describe('nextCardDueDate', () => {
  it('returns this month when the day has not passed', () => {
    expect(nextCardDueDate(15, today)).toEqual(new Date(2026, 7, 15));
  });

  it('returns today when the card falls due today', () => {
    expect(nextCardDueDate(12, today)).toEqual(new Date(2026, 7, 12));
  });

  it('rolls to next month once the day has passed', () => {
    expect(nextCardDueDate(5, today)).toEqual(new Date(2026, 8, 5));
  });

  it('clamps a 31st to the last day of a short month instead of overflowing', () => {
    // September has 30 days: the naive Date(2026, 8, 31) is 1 Oct.
    expect(nextCardDueDate(31, new Date(2026, 8, 20))).toEqual(new Date(2026, 8, 30));
  });

  it('rejects days no month has', () => {
    expect(nextCardDueDate(0, today)).toBeNull();
    expect(nextCardDueDate(32, today)).toBeNull();
    expect(nextCardDueDate(Number.NaN, today)).toBeNull();
  });
});

describe('buildUpcomingDues', () => {
  it('merges subscriptions and cards, soonest first', () => {
    const dues = buildUpcomingDues({
      subscriptions: [subscription({ id: 1, next_due_date: '2026-08-20' })],
      accounts: [card({ id: 10, due_day: 15 })],
      today,
    });

    expect(dues.map((due) => due.key)).toEqual(['card-10', 'subscription-1']);
    expect(dues[0].daysUntil).toBe(3);
    expect(dues[1].daysUntil).toBe(8);
  });

  it('leaves out paused and cancelled subscriptions', () => {
    const dues = buildUpcomingDues({
      subscriptions: [
        subscription({ id: 1, status: 'paused' }),
        subscription({ id: 2, status: 'cancelled' }),
      ],
      accounts: [],
      today,
    });

    expect(dues).toEqual([]);
  });

  it('keeps an overdue subscription however far back it is', () => {
    const dues = buildUpcomingDues({
      subscriptions: [subscription({ id: 1, next_due_date: '2026-06-01' })],
      accounts: [],
      today,
    });

    expect(dues).toHaveLength(1);
    expect(dues[0].state).toBe('overdue');
    expect(dues[0].daysUntil).toBeLessThan(0);
  });

  it('drops anything past the horizon', () => {
    const dues = buildUpcomingDues({
      subscriptions: [subscription({ id: 1, next_due_date: '2026-10-01' })],
      accounts: [],
      today,
      horizonDays: 30,
    });

    expect(dues).toEqual([]);
  });

  it('never reports a credit limit as an amount due', () => {
    const dues = buildUpcomingDues({
      subscriptions: [],
      accounts: [card({ credit_limit: 200000, summary: undefined })],
      today,
    });

    expect(dues[0].amount).toBeNull();
  });

  it('states the outstanding balance a card actually owes', () => {
    const dues = buildUpcomingDues({
      subscriptions: [],
      accounts: [card({ credit_limit: 200000, summary: { outstanding: 12000 } as never })],
      today,
    });

    expect(dues[0].amount).toBe(12000);
  });

  it('ignores accounts that are not credit cards', () => {
    const dues = buildUpcomingDues({
      subscriptions: [],
      accounts: [card({ type: 'bank', due_day: 15 })],
      today,
    });

    expect(dues).toEqual([]);
  });

  it('ignores a card with no due day set', () => {
    const dues = buildUpcomingDues({
      subscriptions: [],
      accounts: [card({ due_day: undefined })],
      today,
    });

    expect(dues).toEqual([]);
  });

  it('labels states off the day count', () => {
    const dues = buildUpcomingDues({
      subscriptions: [
        subscription({ id: 1, next_due_date: '2026-08-12' }),
        subscription({ id: 2, next_due_date: '2026-08-14' }),
        subscription({ id: 3, next_due_date: '2026-09-05' }),
        subscription({ id: 4, next_due_date: '2026-08-10' }),
      ],
      accounts: [],
      today,
    });

    expect(dues.map((due) => due.state)).toEqual(['overdue', 'today', 'soon', 'scheduled']);
  });

  it('totals only the amounts it has', () => {
    const dues = buildUpcomingDues({
      subscriptions: [subscription({ id: 1, amount: 499 })],
      accounts: [card({ summary: undefined })],
      today,
    });

    expect(totalUpcomingAmount(dues)).toBe(499);
  });
});

describe('formatDueLabel', () => {
  const label = (nextDue: string) =>
    formatDueLabel(
      buildUpcomingDues({ subscriptions: [subscription({ next_due_date: nextDue })], accounts: [], today })[0]
    );

  it('reads in days near the date and in dates further out', () => {
    expect(label('2026-08-12')).toBe('Due today');
    expect(label('2026-08-13')).toBe('Due tomorrow');
    expect(label('2026-08-17')).toBe('Due in 5 days');
    expect(label('2026-08-11')).toBe('1 day overdue');
    expect(label('2026-08-09')).toBe('3 days overdue');
    expect(label('2026-09-05')).toMatch(/^Due 5 Sep/);
  });
});

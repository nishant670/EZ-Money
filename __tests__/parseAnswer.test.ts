import {
  answerHasSoleEntry,
  describeAnswerCount,
  describeAnswerScope,
} from '@/components/home/AnswerCard';
import {
  isParseAnswer,
  looksLikeQuestion,
  parseEntryDraft,
  type LedgerAnswer,
  type ParseAnswer,
} from '@/lib/parse';
import { openAnswerTransactions } from '@/lib/transaction-links';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

const answerFixture = (overrides: Partial<LedgerAnswer> = {}): LedgerAnswer => ({
  status: 'answered',
  metric: 'spend_total',
  amount: 4820,
  currency: 'INR',
  transaction_count: 14,
  subject: 'Food & Drinks',
  entry_type: 'expense',
  period: { kind: 'this_month', label: 'this month', start_date: '2026-08-01', end_date: '2026-08-15' },
  group_by: 'merchant',
  breakdown: [],
  suggestions: [],
  filters: {
    type: 'expense',
    category: 'Food & Drinks',
    start_date: '2026-08-01',
    end_date: '2026-08-15',
  },
  ...overrides,
});

const jsonResponse = (payload: unknown, ok = true) =>
  ({
    ok,
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  }) as unknown as Response;

beforeEach(() => {
  global.fetch = jest.fn();
  mockPush.mockClear();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('the question direction of the parse channel', () => {
  it('tells an answer from a draft by stage alone', async () => {
    const answer: ParseAnswer = {
      stage: 'answer',
      intent: 'question',
      source_text: 'how much did I spend on food this month',
      answer: answerFixture(),
      credits_charged: 5,
    };
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      jsonResponse(answer)
    );

    const result = await parseEntryDraft({
      token: 'token',
      hintText: 'how much did I spend on food this month',
    });

    expect(isParseAnswer(result)).toBe(true);
    if (!isParseAnswer(result)) throw new Error('unreachable');
    expect(result.answer.amount).toBe(4820);
  });

  it('does not mistake a draft for an answer', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      jsonResponse({
        stage: 'draft',
        type: 'expense',
        title: 'Metro',
        amount: 45,
        currency: 'INR',
        mode: 'UPI',
        category: 'Transport',
        date: '2026-08-12',
        source_text: 'metro 45 via upi',
      })
    );

    const result = await parseEntryDraft({ token: 'token', hintText: 'metro 45 via upi' });

    expect(isParseAnswer(result)).toBe(false);
  });
});

describe('looksLikeQuestion', () => {
  // This only decides whether the draft sheet opens before the response lands,
  // so the bar is "obvious question", not "correct classifier".
  it.each([
    'how much did I spend on food this month?',
    'How much did I spend on food this month',
    'what did I pay Swiggy in July',
    'where did my money go last month',
    'did I pay rent',
    'show me my biggest expense',
    'kitna kharch hua food pe',
    'is my spending up',
    // The telegraphic form. No verb, no question mark, no amount — which is
    // how people actually type into a field that behaves like a search box,
    // and what used to open a transaction form instead of answering.
    'today spend',
    'today spends',
    'food spends',
    'this month expense',
    'biggest spend last week',
    'swiggy total',
    'spend last 30 days',
  ])('reads %p as a question', (text) => {
    expect(looksLikeQuestion(text)).toBe(true);
  });

  it.each([
    'spent 450 on groceries at dmart via upi yesterday',
    'chai 80 cash',
    'netflix 199 monthly subscription',
    'paid 1200 to Rahul, split with him',
    // An amount outranks every word around it: this is money that moved,
    // however much it reads like the question above.
    'today spend 250',
    // No amount either, but nothing here asks about records — an incomplete
    // capture still belongs in the draft sheet.
    'paid rent to landlord',
    '',
  ])('reads %p as a capture', (text) => {
    expect(looksLikeQuestion(text)).toBe(false);
  });
});

describe('the tap-through', () => {
  it('opens the list on the filters the number was computed over', () => {
    openAnswerTransactions(answerFixture().filters);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: {
        category: 'Food & Drinks',
        q: undefined,
        mode: undefined,
        start_date: '2026-08-01',
        end_date: '2026-08-15',
        type: 'Expense',
      },
    });
  });

  it('carries a merchant answer through as the list search, not a category', () => {
    openAnswerTransactions({ type: 'expense', q: 'Swiggy', start_date: '2026-07-01', end_date: '2026-07-31' });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: {
        category: undefined,
        q: 'Swiggy',
        mode: undefined,
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        type: 'Expense',
      },
    });
  });

  it('drops a type it does not recognise rather than guessing one', () => {
    openAnswerTransactions({ type: 'transfer', category: 'Bills' });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: {
        category: 'Bills',
        q: undefined,
        mode: undefined,
        start_date: undefined,
        end_date: undefined,
        type: undefined,
      },
    });
  });
});

describe('what the card says around the number', () => {
  // A figure with no stated scope cannot be checked, so the scope line is not
  // optional decoration — it is what makes the answer falsifiable.
  it('always names the period', () => {
    expect(describeAnswerScope(answerFixture())).toBe('Food & Drinks · this month');
    expect(describeAnswerScope(answerFixture({ subject: '', period: { kind: 'all_time', label: 'all time' } })))
      .toBe('all time');
  });

  it('names what a subject-less total covers', () => {
    expect(
      describeAnswerScope(answerFixture({ subject: '', metric: 'net', period: { kind: 'this_month', label: 'this month' } }))
    ).toBe('income minus spending · this month');
  });

  it('counts the transactions behind the figure, except when the figure is the count', () => {
    expect(describeAnswerCount(answerFixture())).toBe('from 14 transactions');
    expect(describeAnswerCount(answerFixture({ transaction_count: 1 }))).toBe('from 1 transaction');
    expect(describeAnswerCount(answerFixture({ metric: 'count' }))).toBeNull();
  });
});

/**
 * What the card puts under the number.
 *
 * "See the transaction" was a button asking the reader to go and find out what
 * the one transaction was, and the destination was a list holding exactly that
 * row — two taps to reach a thing the answer had already narrowed to one. The
 * row goes on the card instead, and it opens the entry.
 */
describe('the evidence under an answer', () => {
  it('treats a lone transaction as the answer itself', () => {
    const answer = answerFixture({
      transaction_count: 1,
      largest_entry: {
        entry_id: 42,
        title: 'Paan Shop',
        merchant: 'Paan Shop',
        category: 'Food & Drinks',
        amount: 45,
        date: '2026-08-26',
      },
    });

    expect(answerHasSoleEntry(answer)).toBe(true);
  });

  it('does not mistake the biggest of many for the only one', () => {
    // A `largest` answer names an entry because the entry is what was asked
    // for — the list behind it still holds every other row, and the
    // tap-through still has somewhere to go.
    const answer = answerFixture({
      metric: 'largest',
      transaction_count: 14,
      largest_entry: {
        entry_id: 9,
        title: 'Rent',
        merchant: '',
        category: 'Bills',
        amount: 13000,
        date: '2026-08-22',
      },
    });

    expect(answerHasSoleEntry(answer)).toBe(false);
  });

  it('has nothing to show when the server sent no entry', () => {
    expect(answerHasSoleEntry(answerFixture({ transaction_count: 1 }))).toBe(false);
  });
});

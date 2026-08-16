import {
  describeMonthlyChange,
  monthFromActionURL,
  monthlyReviewShareText,
  type MonthlyReview,
} from '@/lib/monthly-review';

const reviewFixture = (overrides: Partial<MonthlyReview> = {}): MonthlyReview => ({
  month: '2026-08',
  label: 'August 2026',
  previous_label: 'July',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
  available: true,
  summary: {
    total_spent: 40091,
    total_income: 90000,
    daily_average: 1293.26,
    transaction_count: 33,
    previous_total_spent: 45558,
    spend_change: -12,
    spend_change_comparable: true,
  },
  top_categories: [
    { category: 'Bills', amount: 20000, percentage: 49.9, change: 0, change_comparable: false },
    { category: 'Food & Drinks', amount: 12091, percentage: 30.2, change: 26, change_comparable: true },
    { category: 'Transport', amount: 8000, percentage: 19.9, change: -4, change_comparable: true },
  ],
  top_merchants: [{ merchant: 'Swiggy', amount: 5400, transaction_count: 12 }],
  daily_spending: [],
  biggest_change: {
    category: 'Food & Drinks',
    amount: 12091,
    previous_amount: 9596,
    change: 26,
    comparable: true,
    direction: 'higher',
  },
  busiest_day: { date: '2026-08-13', amount: 20000, count: 3 },
  ...overrides,
});

describe('monthFromActionURL', () => {
  it('reads the month the server routed to', () => {
    expect(monthFromActionURL('/monthly-review/2026-08')).toBe('2026-08');
  });

  it('ignores everything else, so a stray action_url cannot open the wrong screen', () => {
    expect(monthFromActionURL('/entry/42')).toBeNull();
    expect(monthFromActionURL('/monthly-review')).toBeNull();
    expect(monthFromActionURL('/monthly-review/august')).toBeNull();
    expect(monthFromActionURL('/monthly-review/2026-08/extra')).toBeNull();
    expect(monthFromActionURL(undefined)).toBeNull();
  });
});

describe('describeMonthlyChange', () => {
  it('phrases a fall as under and a rise as over', () => {
    expect(describeMonthlyChange(reviewFixture())).toBe('12% under July');
    expect(
      describeMonthlyChange(
        reviewFixture({
          summary: { ...reviewFixture().summary, spend_change: 27 },
        })
      )
    ).toBe('27% over July');
  });

  // The server sends 0 when the previous month was too thin to divide by, and
  // "0% under July" is a claim that spending was flat — which nobody made.
  it('says nothing at all when the comparison is not publishable', () => {
    expect(
      describeMonthlyChange(
        reviewFixture({
          summary: {
            ...reviewFixture().summary,
            spend_change: 0,
            spend_change_comparable: false,
          },
        })
      )
    ).toBeNull();
  });
});

describe('the share text', () => {
  it('formats every amount through formatMoney', () => {
    const text = monthlyReviewShareText(reviewFixture());

    expect(text).toContain('August 2026 on Finnri');
    expect(text).toContain('Spent ₹40,091 across 33 transactions — 12% under July.');
    expect(text).toContain('Earned ₹90,000, kept ₹49,909.');
    expect(text).toContain('· Food & Drinks — ₹12,091');
    expect(text).toContain('Biggest change: Food & Drinks, 26% higher.');
    // Indian grouping, and no raw toFixed output anywhere.
    expect(text).not.toMatch(/\d{5,}/);
  });

  it('drops the comparison rather than quoting an unpublishable one', () => {
    const text = monthlyReviewShareText(
      reviewFixture({
        summary: {
          ...reviewFixture().summary,
          spend_change: 0,
          spend_change_comparable: false,
        },
      })
    );
    expect(text).toContain('Spent ₹40,091 across 33 transactions.');
    expect(text).not.toContain('July');
  });

  it('names a new category without inventing a percentage for it', () => {
    const text = monthlyReviewShareText(
      reviewFixture({
        biggest_change: {
          category: 'Travel',
          amount: 18000,
          previous_amount: 0,
          change: 0,
          comparable: false,
          direction: 'higher',
        },
      })
    );
    expect(text).toContain('Biggest change: Travel.');
    expect(text).not.toContain('0% higher');
  });

  it('says "over by" when the month spent more than it earned', () => {
    const text = monthlyReviewShareText(
      reviewFixture({
        summary: { ...reviewFixture().summary, total_income: 30000, total_spent: 40091 },
      })
    );
    expect(text).toContain('Earned ₹30,000, over by ₹10,091.');
  });

  it('leaves income out entirely when none was recorded', () => {
    const text = monthlyReviewShareText(
      reviewFixture({
        summary: { ...reviewFixture().summary, total_income: 0 },
      })
    );
    expect(text).not.toContain('Earned');
    expect(text).not.toContain('kept');
  });

  it('keeps a single transaction singular', () => {
    const text = monthlyReviewShareText(
      reviewFixture({
        summary: {
          ...reviewFixture().summary,
          transaction_count: 1,
          spend_change_comparable: false,
        },
      })
    );
    expect(text).toContain('across 1 transaction.');
  });
});

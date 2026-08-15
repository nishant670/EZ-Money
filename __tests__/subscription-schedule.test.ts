import { inferNextSubscriptionDate } from '@/lib/subscription-schedule';
import { toApiDateOnly } from '@/components/money/SubscriptionsPanel';

describe('subscription schedule', () => {
  it('advances calendar-daily payments by one day', () => {
    expect(inferNextSubscriptionDate('2026-08-01', 'daily')).toBe('2026-08-02');
  });

  it('skips weekends for market-day investments', () => {
    expect(inferNextSubscriptionDate('2026-07-31', 'business_daily')).toBe('2026-08-03');
  });

  it('skips NSE MF Invest holidays', () => {
    expect(inferNextSubscriptionDate('2026-09-13', 'business_daily')).toBe('2026-09-15');
  });
});

describe('toApiDateOnly', () => {
  it('takes the date off the RFC3339 timestamp the API actually sends', () => {
    // The wire format is `2026-09-13T00:00:00Z`, not a bare date. Reading it
    // raw made every subscription card render today, and put a value into form
    // state that the save validation then rejected — so no existing
    // subscription could be edited.
    expect(toApiDateOnly('2026-09-13T00:00:00Z')).toBe('2026-09-13');
    expect(toApiDateOnly('2026-09-13T18:30:00.000+05:30')).toBe('2026-09-13');
  });

  it('passes a bare date straight through', () => {
    expect(toApiDateOnly('2026-09-13')).toBe('2026-09-13');
  });

  it('returns empty for anything it cannot read, which the form treats as unset', () => {
    expect(toApiDateOnly(undefined)).toBe('');
    expect(toApiDateOnly(null)).toBe('');
    expect(toApiDateOnly('')).toBe('');
    expect(toApiDateOnly('13/09/2026')).toBe('');
  });
});

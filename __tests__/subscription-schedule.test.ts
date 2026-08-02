import { inferNextSubscriptionDate } from '@/lib/subscription-schedule';

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

import { candidateKeyOf, monthlyTotalOf } from '@/components/money/RecurringCandidatesCard';
import { monthlyEquivalent } from '@/components/money/SubscriptionsPanel';
import type { DashboardRecurringCandidate } from '@/lib/insights';

const candidate = (
  overrides: Partial<DashboardRecurringCandidate> = {}
): DashboardRecurringCandidate => ({
  candidate_key: 'netflix|entertainment',
  label: 'Netflix',
  merchant: 'Netflix',
  category: 'Entertainment',
  average_amount: 199,
  interval_guess: 'monthly',
  confidence: 0.9,
  occurrences: 3,
  last_seen_date: '2026-07-12',
  next_expected_date: '2026-08-12',
  review_due: true,
  ...overrides,
});

describe('recurring candidate headline', () => {
  // The card's whole claim is "₹X/month". A weekly pattern counted at face
  // value would understate the monthly figure by four, which is the kind of
  // wrong number the backlog exists to stop.
  it('normalises every cadence to a monthly figure', () => {
    expect(
      monthlyTotalOf([
        candidate({ average_amount: 199, interval_guess: 'monthly' }),
        candidate({ candidate_key: 'gym|misc', average_amount: 250, interval_guess: 'weekly' }),
      ])
    ).toBe(199 + 250 * 4);
  });

  it('is zero when nothing is selected', () => {
    expect(monthlyTotalOf([])).toBe(0);
  });

  // The key is what the track and dismiss calls address, so a candidate that
  // arrived without one still has to resolve to the server's own format.
  it('falls back to label|category when the server key is missing', () => {
    expect(candidateKeyOf(candidate({ candidate_key: '' }))).toBe('netflix|entertainment');
  });

  it('uses the server key when it is present', () => {
    expect(candidateKeyOf(candidate({ candidate_key: 'spotify|entertainment' }))).toBe(
      'spotify|entertainment'
    );
  });
});

describe('monthlyEquivalent', () => {
  it('converts each billing interval to what it costs per month', () => {
    expect(monthlyEquivalent(100, 'daily')).toBe(3000);
    expect(monthlyEquivalent(100, 'weekly')).toBe(400);
    expect(monthlyEquivalent(100, 'biweekly')).toBe(200);
    expect(monthlyEquivalent(100, 'monthly')).toBe(100);
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100);
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100);
  });

  // Subscriptions can no longer be created on market days, but rows created
  // before that still have to total correctly.
  it('still totals legacy market-day rows', () => {
    expect(monthlyEquivalent(100, 'business_daily')).toBe(3000);
  });
});

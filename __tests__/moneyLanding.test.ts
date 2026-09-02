import { deriveMoneyLandingSegment } from '@/lib/money-landing';
import type { Account } from '@/lib/accounts';
import type { Subscription } from '@/lib/subscriptions';

const today = new Date(2026, 8, 2);
const bank = { id: 1, type: 'bank', name: 'Salary', color: '#fff' } as Account;

describe('deriveMoneyLandingSegment', () => {
  it('keeps an explicit segment', () => {
    expect(
      deriveMoneyLandingSegment({ requestedSegment: 'subscriptions', accounts: [], budgets: [], subscriptions: [], today })
    ).toBe('subscriptions');
  });

  it('lands a fresh account on Accounts', () => {
    expect(deriveMoneyLandingSegment({ accounts: [], budgets: [], subscriptions: [], today })).toBe('accounts');
  });

  it('lets a due-soon item beat onboarding', () => {
    const subscription = {
      id: 2,
      name: 'Music',
      amount: 199,
      status: 'active',
      next_due_date: '2026-09-05',
    } as Subscription;
    expect(
      deriveMoneyLandingSegment({ accounts: [], budgets: [], subscriptions: [subscription], today })
    ).toBe('upcoming');
  });

  it('lands an established account with no plans on Budgets', () => {
    expect(deriveMoneyLandingSegment({ accounts: [bank], budgets: [], subscriptions: [], today })).toBe('budgets');
  });
});

describe('deriveMoneyLandingSegment with entitlement-gated budgets', () => {
  // Budgets answers 402 for free and guest users. The caller turns that into an
  // empty list, so a brand-new account must still be routed to Accounts rather
  // than to the Upcoming fallback.
  it('still lands a fresh account on Accounts when budgets are unavailable', () => {
    expect(
      deriveMoneyLandingSegment({ accounts: [], budgets: [], subscriptions: [], today })
    ).toBe('accounts');
  });
});

describe('deriveMoneyLandingSegment never lands on a paywall', () => {
  // A free user with an account but no plans used to be routed to Budgets,
  // whose only content is an upgrade sheet. Subscriptions is the equivalent
  // setup step that every plan can actually complete.
  it('routes to Subscriptions when Budgets is not on this plan', () => {
    expect(
      deriveMoneyLandingSegment({
        accounts: [bank],
        budgets: [],
        subscriptions: [],
        budgetsAvailable: false,
        today,
      })
    ).toBe('subscriptions');
  });

  it('still prefers Budgets when the plan includes it', () => {
    expect(
      deriveMoneyLandingSegment({
        accounts: [bank],
        budgets: [],
        subscriptions: [],
        budgetsAvailable: true,
        today,
      })
    ).toBe('budgets');
  });
});

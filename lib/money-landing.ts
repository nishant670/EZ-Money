import type { Account } from './accounts';
import type { Budget } from './budgets';
import type { Subscription } from './subscriptions';
import { buildUpcomingDues } from './upcoming';

export type MoneyLandingSegment = 'upcoming' | 'budgets' | 'subscriptions' | 'accounts';

const isMoneyLandingSegment = (value?: string): value is MoneyLandingSegment =>
  value === 'upcoming' || value === 'budgets' || value === 'subscriptions' || value === 'accounts';

export const deriveMoneyLandingSegment = ({
  requestedSegment,
  accounts,
  budgets,
  subscriptions,
  budgetsAvailable = true,
  today = new Date(),
}: {
  requestedSegment?: string;
  accounts: Account[];
  budgets: Budget[];
  subscriptions: Subscription[];
  /**
   * False when Budgets is behind the paywall for this user. Landing someone on
   * a segment that can only show them an upgrade sheet is a worse first screen
   * than the one this rule exists to replace, so the setup nudge moves to
   * Subscriptions — which every plan can use.
   */
  budgetsAvailable?: boolean;
  today?: Date;
}): MoneyLandingSegment => {
  if (isMoneyLandingSegment(requestedSegment)) return requestedSegment;
  const urgent = buildUpcomingDues({ accounts, subscriptions, today, horizonDays: 7 }).some(
    (due) => due.daysUntil <= 7
  );
  if (urgent) return 'upcoming';
  if (accounts.length === 0) return 'accounts';
  if (budgets.length === 0 && subscriptions.length === 0) {
    return budgetsAvailable ? 'budgets' : 'subscriptions';
  }
  return 'upcoming';
};

import type { BillingInterval } from './subscriptions';
import { formatApiDate, parseDateLabel } from './transactions';

// NSE/NMFTM/71897: NSE MF Invest trading holidays for calendar year 2026.
const nseMutualFundHolidays = new Set([
  '2026-01-26',
  '2026-03-03',
  '2026-03-26',
  '2026-03-31',
  '2026-04-03',
  '2026-04-14',
  '2026-05-01',
  '2026-05-28',
  '2026-06-26',
  '2026-09-14',
  '2026-10-02',
  '2026-10-20',
  '2026-11-10',
  '2026-11-24',
  '2026-12-25',
]);

const isNSEMutualFundDay = (date: Date) =>
  date.getDay() !== 0 && date.getDay() !== 6 && !nseMutualFundHolidays.has(formatApiDate(date));

export const addSubscriptionInterval = (date: Date, interval: BillingInterval) => {
  const next = new Date(date);
  switch (interval) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'business_daily':
      do {
        next.setDate(next.getDate() + 1);
      } while (!isNSEMutualFundDay(next));
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
};

export const inferNextSubscriptionDate = (
  paidDate: string | null | undefined,
  interval: BillingInterval | ''
) => {
  if (!paidDate || !interval) return '';
  const parsed = parseDateLabel(paidDate);
  return parsed ? formatApiDate(addSubscriptionInterval(parsed, interval)) : '';
};

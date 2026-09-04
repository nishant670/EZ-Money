import type { DashboardOverviewMonth, DashboardResponse } from './insights';

/**
 * A date range the Insights screen can load, in the shape `PeriodPicker` uses.
 * Declared here rather than imported so this module stays free of components.
 */
export type OverviewRange = {
  start: Date | null;
  end: Date | null;
  label: string;
  preset?: 'this_month' | 'custom';
};

/**
 * The month a range describes, or null when it does not describe one.
 *
 * The overview strip highlights a month only when the window is exactly that
 * whole month. "Last 30 Days" straddles two and belongs to neither, and lighting
 * up whichever one it happened to start in would be a claim the range does not
 * make — the user would read the highlight as "you are looking at August" while
 * a third of the figures came from July.
 */
export const selectedMonthKey = (range: {
  start: Date | null;
  end: Date | null;
}): string | null => {
  const { start, end } = range;
  if (!start || !end) return null;
  if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) return null;
  if (start.getDate() !== 1) return null;
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * A whole calendar month from the overview strip, as a range the screen loads.
 *
 * `now` is a parameter so the current-month case is testable rather than
 * dependent on when the suite happens to run.
 */
export const rangeForOverviewMonth = (
  month: DashboardOverviewMonth,
  now: Date = new Date()
): OverviewRange => {
  const [year, monthNumber] = month.month.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const isCurrentMonth =
    now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth();
  return {
    start,
    // The current month stops today. Running it to the 31st would divide this
    // month's spend across days that have not happened, and every per-day
    // figure on the screen would read low for the whole month.
    end: isCurrentMonth ? now : new Date(year, monthNumber, 0),
    label: start.toLocaleString('default', { month: 'long', year: 'numeric' }),
    preset: isCurrentMonth ? 'this_month' : 'custom',
  };
};

/**
 * Whether the selected window is empty on an account that is not.
 *
 * This is the state the whole tab had no answer for, and it is not an edge
 * case: every account is in it on the 1st of every month, which is exactly when
 * somebody opens Insights to plan. The old screen answered it with its ordinary
 * cards full of zeros — "₹0 per day", "Waiting for data", four ₹0 tiles — each
 * a true statement about the window and a false impression of the account.
 *
 * A genuinely new account is deliberately not this state. There the empty
 * screen is the honest one, and the unlock-progress card already owns it.
 */
export const periodIsEmptyButAccountIsNot = (dashboard: DashboardResponse | null): boolean =>
  Boolean(
    dashboard &&
      dashboard.summary.transaction_count === 0 &&
      dashboard.overview?.has_history
  );

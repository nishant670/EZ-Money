import type { DashboardResponse } from '@/lib/insights';
import {
  periodIsEmptyButAccountIsNot,
  rangeForOverviewMonth,
  selectedMonthKey,
} from '@/lib/insights-periods';

const dashboard = (
  transactionCount: number,
  hasHistory: boolean | undefined
): DashboardResponse =>
  ({
    summary: { transaction_count: transactionCount },
    overview: hasHistory === undefined ? undefined : { has_history: hasHistory },
  }) as unknown as DashboardResponse;

describe('selectedMonthKey', () => {
  it('names the month when the window is exactly that whole month', () => {
    expect(
      selectedMonthKey({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) })
    ).toBe('2026-08');
  });

  it('still names it for a partial current month, which starts on the 1st', () => {
    expect(
      selectedMonthKey({ start: new Date(2026, 8, 1), end: new Date(2026, 8, 3) })
    ).toBe('2026-09');
  });

  it('names nothing for a window that straddles two months', () => {
    // "Last 30 Days" belongs to neither month it covers. Highlighting the one
    // it starts in would tell the reader they are looking at August while a
    // third of the figures came from July.
    expect(
      selectedMonthKey({ start: new Date(2026, 6, 20), end: new Date(2026, 7, 18) })
    ).toBeNull();
  });

  it('names nothing for a window inside one month that does not start on the 1st', () => {
    expect(
      selectedMonthKey({ start: new Date(2026, 7, 10), end: new Date(2026, 7, 20) })
    ).toBeNull();
  });
});

describe('rangeForOverviewMonth', () => {
  const month = (key: string) => ({ month: key, label: 'Aug', spent: 0, income: 0, count: 0 });

  it('covers a past month end to end', () => {
    const range = rangeForOverviewMonth(month('2026-08'), new Date(2026, 8, 4));
    expect(range.start).toEqual(new Date(2026, 7, 1));
    expect(range.end).toEqual(new Date(2026, 7, 31));
    expect(range.preset).toBe('custom');
  });

  it('stops the current month at today', () => {
    // Running it to the 30th would divide this month's spend across days that
    // have not happened, and every per-day figure would read low all month.
    const today = new Date(2026, 8, 4);
    const range = rangeForOverviewMonth(month('2026-09'), today);
    expect(range.start).toEqual(new Date(2026, 8, 1));
    expect(range.end).toBe(today);
    expect(range.preset).toBe('this_month');
  });

  it('handles a December month without rolling into the wrong year', () => {
    const range = rangeForOverviewMonth(month('2025-12'), new Date(2026, 8, 4));
    expect(range.start).toEqual(new Date(2025, 11, 1));
    expect(range.end).toEqual(new Date(2025, 11, 31));
  });
});

describe('periodIsEmptyButAccountIsNot', () => {
  it('is true for a quiet window on an account with history', () => {
    // The state every account is in on the 1st of every month — which is when
    // somebody opens Insights to plan, and when it used to show ₹0 four times.
    expect(periodIsEmptyButAccountIsNot(dashboard(0, true))).toBe(true);
  });

  it('is false for a genuinely new account', () => {
    // There the empty screen is the honest one, and the unlock-progress card
    // already owns it.
    expect(periodIsEmptyButAccountIsNot(dashboard(0, false))).toBe(false);
  });

  it('is false once the window has anything in it', () => {
    expect(periodIsEmptyButAccountIsNot(dashboard(4, true))).toBe(false);
  });

  it('is false against a backend that does not send the overview block', () => {
    expect(periodIsEmptyButAccountIsNot(dashboard(0, undefined))).toBe(false);
  });

  it('is false with no dashboard at all', () => {
    expect(periodIsEmptyButAccountIsNot(null)).toBe(false);
  });
});

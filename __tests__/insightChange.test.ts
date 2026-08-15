import { formatChangeMagnitude, previousWindowLabel } from '@/lib/insights';

/**
 * These cases mirror TestLargeChangesRenderAsAMultiplierNotFourDigits in the
 * backend's insights_comparison_test.go. The app formats the per-category
 * trend line itself, so if the two rules drift a card and the list beneath it
 * will disagree about the same number.
 */
describe('insight change magnitude', () => {
  it('keeps ordinary changes as percentages', () => {
    expect(formatChangeMagnitude(0)).toBe('0%');
    expect(formatChangeMagnitude(45.4)).toBe('45%');
    expect(formatChangeMagnitude(159)).toBe('159%');
  });

  it('drops the sign — direction is carried by the surrounding words', () => {
    expect(formatChangeMagnitude(-62)).toBe('62%');
  });

  it('keeps 300% as the last percentage', () => {
    expect(formatChangeMagnitude(300)).toBe('300%');
  });

  it('renders anything larger as a multiplier', () => {
    expect(formatChangeMagnitude(301)).toBe('4×');
    expect(formatChangeMagnitude(350)).toBe('4.5×');
  });

  it('never shows the four-digit percentages the audit found', () => {
    // "Food & Drinks spending is 2127% higher" and "Spending is 1353% higher".
    expect(formatChangeMagnitude(2127)).toBe('22×');
    expect(formatChangeMagnitude(1353)).toBe('15×');
  });
});

describe('previousWindowLabel', () => {
  it('takes the window a change is measured against out of the backend label', () => {
    expect(
      previousWindowLabel({ start: '2026-08-01', end: '2026-08-12', comparison_label: 'Aug 1–12 vs Jul 1–12' })
    ).toBe('Jul 1–12');
  });

  it('handles a window that straddles a month boundary', () => {
    expect(
      previousWindowLabel({ start: '2026-08-04', end: '2026-08-10', comparison_label: 'Aug 4–10 vs Jul 28 – Aug 3' })
    ).toBe('Jul 28 – Aug 3');
  });

  // The strip prints this inline ("…than the same days last month"), so it can
  // never be empty and must never show half a mangled label.
  it('falls back to words rather than printing nothing', () => {
    expect(previousWindowLabel(undefined)).toBe('the same days last month');
    expect(previousWindowLabel({ start: '', end: '' })).toBe('the same days last month');
    expect(
      previousWindowLabel({ start: '', end: '', comparison_label: 'Aug 1–12' })
    ).toBe('the same days last month');
  });
});

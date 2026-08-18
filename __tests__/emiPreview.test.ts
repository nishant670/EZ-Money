import { previewEMISchedule } from '@/lib/emi-preview';
import { emiInstallmentStatusLabels, formatEMIProgress, isNoCostEMI } from '@/lib/emi-plans';
import type { EMIPlan, EMIPlanProgress } from '@/lib/emi-plans';

describe('previewEMISchedule', () => {
  // The common case in India. Every rupee repays principal, so the limit comes
  // back at exactly the rate the user pays.
  it('splits a no-cost EMI evenly with no interest', () => {
    const preview = previewEMISchedule(60000, 0, 12);
    expect(preview.monthlyAmount).toBe(5000);
    expect(preview.totalInterest).toBe(0);
    expect(preview.totalPayment).toBe(60000);
  });

  it('charges interest on a financed plan', () => {
    const preview = previewEMISchedule(60000, 18, 12);
    expect(preview.monthlyAmount).toBeGreaterThan(5000);
    expect(preview.totalInterest).toBeGreaterThan(0);
    expect(preview.totalPayment).toBeCloseTo(preview.monthlyAmount * 12, 2);
  });

  it('never reports interest on a plan that costs nothing', () => {
    for (const tenure of [3, 6, 9, 12, 18, 24]) {
      expect(previewEMISchedule(30000, 0, tenure).totalInterest).toBe(0);
    }
  });

  it('returns zeros rather than NaN for an empty form', () => {
    expect(previewEMISchedule(0, 0, 12)).toEqual({
      monthlyAmount: 0,
      totalPayment: 0,
      totalInterest: 0,
    });
    expect(previewEMISchedule(60000, 0, 0).monthlyAmount).toBe(0);
  });

  it('rounds to paise, matching the server money type', () => {
    const preview = previewEMISchedule(10000, 0, 3);
    expect(preview.monthlyAmount).toBe(3333.33);
  });
});

describe('EMI display helpers', () => {
  const plan = (overrides: Partial<EMIPlan> = {}): EMIPlan =>
    ({
      id: 1,
      account_id: 1,
      title: 'iPhone 17',
      principal: 60000,
      annual_rate_pct: 0,
      tenure_months: 12,
      monthly_amount: 5000,
      total_interest: 0,
      currency: 'INR',
      purchased_on: '2026-07-10',
      first_installment: '2026-08-10',
      status: 'active',
      progress: {} as EMIPlanProgress,
      ...overrides,
    }) as EMIPlan;

  it('recognises a no-cost plan', () => {
    expect(isNoCostEMI(plan())).toBe(true);
    expect(isNoCostEMI(plan({ annual_rate_pct: 13.5 }))).toBe(false);
  });

  it('reads progress as a count', () => {
    expect(
      formatEMIProgress({ installments_paid: 4, installments_total: 12 } as EMIPlanProgress)
    ).toBe('4 of 12 paid');
  });

  // "On this bill" rather than "Billed": a billed instalment is one the user
  // is being asked to pay right now, not one already behind them.
  it('distinguishes an instalment on the current bill from a paid one', () => {
    expect(emiInstallmentStatusLabels.scheduled).toBe('Upcoming');
    expect(emiInstallmentStatusLabels.billed).toBe('On this bill');
    expect(emiInstallmentStatusLabels.paid).toBe('Paid');
  });
});

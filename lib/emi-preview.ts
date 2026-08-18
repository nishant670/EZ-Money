/**
 * A local preview of what an EMI plan will cost.
 *
 * This mirrors `calculateMonthlyEMI` in `internal/http/emi.go`, and exists
 * only so the sheet can show the monthly figure as the user types rather than
 * making a round trip per keystroke. The server recomputes the real schedule
 * on save and its answer is the one that gets stored, so a rounding difference
 * of a rupee here is cosmetic.
 */

export type EMIPreview = {
  monthlyAmount: number;
  totalPayment: number;
  totalInterest: number;
};

/** Rounds to paise, matching the server's fixed-point money. */
const round = (amount: number) => Math.round(amount * 100) / 100;

export const previewEMISchedule = (
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
): EMIPreview => {
  if (principal <= 0 || tenureMonths < 1) {
    return { monthlyAmount: 0, totalPayment: 0, totalInterest: 0 };
  }

  const monthlyRate = annualRatePct / 12 / 100;

  // No-cost EMI: every rupee of the instalment repays principal, so the limit
  // comes back at exactly the rate the user pays.
  if (monthlyRate === 0) {
    const monthly = round(principal / tenureMonths);
    return { monthlyAmount: monthly, totalPayment: principal, totalInterest: 0 };
  }

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const monthly = round((principal * monthlyRate * factor) / (factor - 1));
  const totalPayment = round(monthly * tenureMonths);

  return {
    monthlyAmount: monthly,
    totalPayment,
    totalInterest: round(totalPayment - principal),
  };
};

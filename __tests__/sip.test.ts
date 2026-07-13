import { calculateSIP, sipPresets } from '@/lib/sip';

describe('SIP calculator', () => {
  it('projects a zero-return custom SIP from invested amount only', () => {
    const result = calculateSIP({
      monthlyInvestment: 1000,
      expectedAnnualReturnPercent: 0,
      tenureYears: 1,
      annualStepUpPercent: 0,
      currentCorpus: 5000,
    });

    expect(result.investedAmount).toBe(17000);
    expect(result.maturityValue).toBe(17000);
    expect(result.estimatedReturns).toBe(0);
    expect(result.breakdown).toHaveLength(1);
  });

  it('includes editable presets for common investment categories', () => {
    expect(sipPresets.map((preset) => preset.id)).toEqual([
      'mutual_fund',
      'ppf',
      'nps',
      'rd',
      'custom',
    ]);
  });
});

import { clampDateToStatementCycle } from '@/lib/statement-composer';

describe('statement itemisation composer', () => {
  it.each([
    ['before the cycle', '2026-06-01', '2026-07-06'],
    ['inside the cycle', '2026-07-20', '2026-07-20'],
    ['after the cycle', '2026-09-12', '2026-08-05'],
  ])('clamps %s', (_label, today, expected) => {
    expect(clampDateToStatementCycle(today, '2026-07-06', '2026-08-05')).toBe(expected);
  });

  it('does not invent a date for malformed route parameters', () => {
    expect(clampDateToStatementCycle('2026-09-12', 'July', 'August')).toBe('2026-09-12');
  });
});

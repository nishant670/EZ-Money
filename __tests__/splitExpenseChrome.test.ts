import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('split expense chrome', () => {
  const expenseSource = readFileSync(
    join(process.cwd(), 'components', 'split', 'expense', 'AddExpenseModal.tsx'),
    'utf8'
  );

  it('keeps the three-step composer inside the shared 92% sheet', () => {
    expect(expenseSource).toContain('<AnimatedBottomSheet');
    expect(expenseSource).toContain("sheetStyle={{ height: '92%' }}");
    expect(expenseSource).not.toContain('<Modal');
    expect(expenseSource).toContain("flowScreen === 'expense'");
    expect(expenseSource).toContain("flowScreen === 'split_choice'");
    expect(expenseSource).toContain('<AdjustSplitScreen');
  });

  it('uses the shared amount, field, and canonical category primitives', () => {
    expect(expenseSource).toContain('<AmountDisplay');
    expect(expenseSource).toContain('<AmountKeypad');
    expect(expenseSource).toContain('<DraftFieldCard');
    expect(expenseSource).toContain('CATEGORIES.map');
    expect(expenseSource).toContain('categoryVisual');
  });
});

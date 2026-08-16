import {
  buildDraftReviewPlan,
  draftSummaryParts,
  normalizeDraftField,
} from '@/lib/ai-draft-review';

const filledValues = {
  amount: '250.00',
  type: 'Expense',
  title: 'Lunch',
  category: 'Food & Drinks',
  mode: 'UPI',
  account: 'HDFC UPI',
  date: 'Yesterday',
  merchant: 'DMart',
  tag: 'General',
  notes: '',
};

describe('normalizeDraftField', () => {
  it('maps the parser names onto the form fields', () => {
    expect(normalizeDraftField('account_hint')).toBe('account');
    expect(normalizeDraftField('accountId')).toBe('account');
    // One card shows the date and the time, so one flag covers both.
    expect(normalizeDraftField('time')).toBe('date');
    expect(normalizeDraftField('card_network')).toBe('mode');
    expect(normalizeDraftField('note')).toBe('notes');
  });

  it('ignores anything the sheet does not render as a field', () => {
    expect(normalizeDraftField('split_candidate')).toBeNull();
    expect(normalizeDraftField('source_text')).toBeNull();
  });
});

describe('buildDraftReviewPlan', () => {
  it('puts the least confident field first', () => {
    const plan = buildDraftReviewPlan({
      confidence: { merchant: 0.4, category: 0.2, title: 0.95 },
      values: filledValues,
    });

    expect(plan.flagged).toEqual(['category', 'merchant']);
    expect(plan.flagged).not.toContain('title');
  });

  it('treats a missing field as less certain than a low-confidence guess', () => {
    const plan = buildDraftReviewPlan({
      missingFields: ['account_hint'],
      confidence: { category: 0.3 },
      values: filledValues,
    });

    expect(plan.flagged).toEqual(['account', 'category']);
  });

  it('flags a required field the parser left blank without reporting it', () => {
    // Save stops on a blank title, so it has to be reachable — a collapsed
    // summary would hide the only field standing between the user and a save.
    const plan = buildDraftReviewPlan({
      confidence: { title: 0.99 },
      values: { ...filledValues, title: '' },
    });

    expect(plan.flagged).toContain('title');
    expect(plan.confident).not.toContain('title');
  });

  it('keeps an empty optional field out of the summary', () => {
    const plan = buildDraftReviewPlan({ values: filledValues });

    expect(plan.flagged).toEqual([]);
    expect(plan.confident).toContain('merchant');
    expect(plan.optional).toEqual(['notes']);
  });

  it('takes the worst thing said about a field', () => {
    const plan = buildDraftReviewPlan({
      confidence: { mode: 0.99 },
      needsConfirmation: { card_network: true },
      values: filledValues,
    });

    expect(plan.flagged).toEqual(['mode']);
  });
});

describe('draftSummaryParts', () => {
  it('reads payment, category, date, then who took the money', () => {
    const plan = buildDraftReviewPlan({ values: filledValues });

    expect(draftSummaryParts(plan.confident, filledValues)).toEqual([
      'UPI',
      'Food & Drinks',
      'Yesterday',
      'DMart',
    ]);
  });

  it('does not say the merchant twice under two names', () => {
    const values = { ...filledValues, title: 'DMart groceries' };
    const plan = buildDraftReviewPlan({ values });

    expect(draftSummaryParts(plan.confident, values)).not.toContain('DMart groceries');
  });

  it('leaves out what is flagged, since that is shown in full above', () => {
    const values = { ...filledValues, merchant: '' };
    const plan = buildDraftReviewPlan({ missingFields: ['mode'], values });

    expect(draftSummaryParts(plan.confident, values)).toEqual([
      'Food & Drinks',
      'Yesterday',
      'Lunch',
      'HDFC UPI',
    ]);
  });
});

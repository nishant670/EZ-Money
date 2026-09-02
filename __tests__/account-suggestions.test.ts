import {
  getAutoAccountPayloadForPaymentMode,
  suggestAccountFromTransaction,
  type Account,
} from '@/lib/accounts';
import { PAYMENT_MODES } from '@/lib/payment-modes';

const account = (overrides: Partial<Account>): Account => ({
  id: 1,
  type: 'credit_card',
  name: 'Card',
  color: '#8257E5',
  ...overrides,
});

describe('transaction account suggestions', () => {
  it('prefills provider, card type, and last four from a parser hint', () => {
    expect(
      suggestAccountFromTransaction(
        { mode: 'Credit Card', accountHint: 'my HDFC card ending 1234', cardNetwork: 'Visa' },
        []
      )
    ).toMatchObject({
      type: 'credit_card',
      provider: 'HDFC',
      identifier: '1234',
      name: 'HDFC Credit Card',
    });
  });

  it('does not suggest an account when that provider already exists', () => {
    expect(
      suggestAccountFromTransaction(
        { mode: 'Credit Card', accountHint: 'HDFC card' },
        [account({ provider: 'HDFC Bank', name: 'HDFC Millennia' })]
      )
    ).toBeNull();
  });

  it('stops asking once the hinted account is added to the list', () => {
    const hint = { mode: 'UPI', accountHint: 'SBI upi' };
    const before: Account[] = [];
    expect(suggestAccountFromTransaction(hint, before)).toMatchObject({
      type: 'upi',
      provider: 'SBI',
    });

    // The prompt is re-derived from the live accounts, so the account created
    // from the prompt itself settles it.
    const after = [account({ id: 2, type: 'upi', name: 'SBI Account', provider: 'SBI' })];
    expect(suggestAccountFromTransaction(hint, after)).toBeNull();
  });

  it('does not invent a suggestion without a specific account hint', () => {
    expect(
      suggestAccountFromTransaction({ mode: 'Credit Card', accountHint: 'my credit card' }, [])
    ).toBeNull();
  });
});

describe('auto-create payload coverage', () => {
  // `Bank Account` was missing, so "Create one for me" threw before it reached
  // the network — on salary, the transaction most likely to need it. A mode
  // without a default is a dead button, so assert the whole set rather than
  // the one that broke.
  it('has an auto-create payload for every payment mode', () => {
    const missing = PAYMENT_MODES.filter(
      (mode) => getAutoAccountPayloadForPaymentMode(mode) === null
    );
    expect(missing).toEqual([]);
  });

  it('creates a bank account for bank-account mode', () => {
    const payload = getAutoAccountPayloadForPaymentMode('Bank Account');
    expect(payload).toMatchObject({ type: 'bank' });
  });
});

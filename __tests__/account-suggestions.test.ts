import { suggestAccountFromTransaction, type Account } from '@/lib/accounts';

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

  it('does not invent a suggestion without a specific account hint', () => {
    expect(
      suggestAccountFromTransaction({ mode: 'Credit Card', accountHint: 'my credit card' }, [])
    ).toBeNull();
  });
});

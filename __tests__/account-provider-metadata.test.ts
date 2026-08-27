import { formatAccountIdentifier, getAccountVisual } from '@/lib/account-display';
import { suggestAccountFromTransaction, toAccountPayload, type Account } from '@/lib/accounts';

const structuredAccount: Account = {
  id: 7,
  type: 'credit_card',
  name: 'Travel card',
  color: '#8257E5',
  provider: 'HDFC Bank',
  provider_id: 'hdfc',
  provider_details: {
    id: 'hdfc',
    display_name: 'HDFC Bank',
    type_support: ['bank', 'credit_card', 'debit_card'],
    asset_key: 'bank',
    aliases: ['HDFC', 'HDFC card'],
  },
  last4: '1234',
};

describe('structured account metadata', () => {
  it('prefers type-specific identifiers and sends both structured and legacy fields', () => {
    expect(formatAccountIdentifier(structuredAccount)).toBe('•••• 1234');
    expect(toAccountPayload(structuredAccount)).toMatchObject({
      provider_id: 'hdfc',
      last4: '1234',
    });
  });

  it('uses a provider visual without introducing a provider colour', () => {
    expect(getAccountVisual(structuredAccount)).toMatchObject({ icon: 'bank', color: '#A855F7' });
  });

  it('matches transaction hints through provider aliases', () => {
    expect(
      suggestAccountFromTransaction({ mode: 'Credit Card', accountHint: 'HDFC card ending 1234' }, [
        structuredAccount,
      ])
    ).toBeNull();
  });

  it('shows UPI handles without treating their digits as card last-four', () => {
    expect(
      formatAccountIdentifier({
        ...structuredAccount,
        type: 'upi',
        last4: '',
        upi_handle: 'nishant27@okhdfcbank',
      })
    ).toBe('nishant27@okhdfcbank');
  });
});

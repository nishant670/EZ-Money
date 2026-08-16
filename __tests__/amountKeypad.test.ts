import { appendAmountKey, hasEnteredAmount } from '@/components/transactions/AmountKeypad';

describe('appendAmountKey', () => {
  it('builds a number one digit at a time', () => {
    expect('325'.split('').reduce<string>((value, key) => appendAmountKey(value, key as '3'), '')).toBe(
      '325'
    );
  });

  it('treats a lone leading zero as a placeholder', () => {
    expect(appendAmountKey('0', '5')).toBe('5');
    expect(appendAmountKey('0', '0')).toBe('0');
    // ...but a zero after the point is a real digit.
    expect(appendAmountKey('0.', '0')).toBe('0.0');
  });

  it('allows exactly one decimal point', () => {
    expect(appendAmountKey('42', '.')).toBe('42.');
    expect(appendAmountKey('42.', '.')).toBe('42.');
    expect(appendAmountKey('42.5', '.')).toBe('42.5');
  });

  it('opens the paise with a zero when the point comes first', () => {
    expect(appendAmountKey('', '.')).toBe('0.');
  });

  it('refuses a third decimal place', () => {
    expect(appendAmountKey('4.50', '7')).toBe('4.50');
  });

  it('caps the rupees at nine digits', () => {
    expect(appendAmountKey('999999999', '9')).toBe('999999999');
    expect(appendAmountKey('99999999', '9')).toBe('999999999');
  });

  it('deletes one character at a time and stops at empty', () => {
    expect(appendAmountKey('42.5', 'delete')).toBe('42.');
    expect(appendAmountKey('4', 'delete')).toBe('');
    expect(appendAmountKey('', 'delete')).toBe('');
  });
});

describe('hasEnteredAmount', () => {
  it('is what gates the save button', () => {
    expect(hasEnteredAmount('')).toBe(false);
    expect(hasEnteredAmount('0')).toBe(false);
    expect(hasEnteredAmount('0.')).toBe(false);
    expect(hasEnteredAmount('0.01')).toBe(true);
    expect(hasEnteredAmount('325')).toBe(true);
  });
});

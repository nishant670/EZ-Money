import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Account, AccountType, normalizeAccountType } from '@/lib/accounts';

export const accountTypeLabels: Record<AccountType, string> = {
  cash: 'Cash',
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  bank: 'Bank account',
  wallet: 'Wallet',
  upi: 'UPI',
  other: 'Other account',
};

export const accountVisuals: Record<
  AccountType,
  {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    bg: string;
  }
> = {
  cash: { icon: 'cash', color: '#64748B', bg: '#F1F5F9' },
  credit_card: { icon: 'credit-card-outline', color: '#A855F7', bg: '#F3E8FF' },
  debit_card: { icon: 'cash-multiple', color: '#14B8A6', bg: '#CCFBF1' },
  bank: { icon: 'bank-outline', color: '#2563EB', bg: '#DBEAFE' },
  wallet: { icon: 'wallet-outline', color: '#F97316', bg: '#FFEDD5' },
  upi: { icon: 'qrcode-scan', color: '#22C55E', bg: '#DCFCE7' },
  other: { icon: 'wallet-outline', color: '#64748B', bg: '#F1F5F9' },
};

export const formatCurrency = (value?: number | null) => {
  const numericValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const amount = Math.abs(safeValue);
  const formatted = amount.toLocaleString('en-IN', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });

  return `${safeValue < 0 ? '-' : ''}₹${formatted}`;
};

export const formatAccountIdentifier = (account: Account) => {
  const lastDigits = account.identifier?.replace(/\D/g, '').slice(-4);
  if (lastDigits) return `•••• ${lastDigits}`;
  if (account.provider) return account.provider;
  return accountTypeLabels[normalizeAccountType(account.type)];
};

export const getAccountDisplayAmount = (account: Account) => {
  if (typeof account.balance === 'number' && account.balance !== 0) return account.balance;
  if (normalizeAccountType(account.type) === 'credit_card' && account.credit_limit) {
    return account.credit_limit;
  }
  return account.balance ?? 0;
};

export const getCreditDueLabel = (dueDay?: number) => {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (dueDate < startOfToday) dueDate.setMonth(dueDate.getMonth() + 1);

  const diffDays = Math.ceil((dueDate.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due on ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Account, AccountType, normalizeAccountType } from '@/lib/accounts';
import { formatRelativeDay } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';

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

export const formatAccountIdentifier = (account: Account) => {
  const lastDigits = account.identifier?.replace(/\D/g, '').slice(-4);
  if (lastDigits) return `•••• ${lastDigits}`;
  if (account.provider) return account.provider;
  return accountTypeLabels[normalizeAccountType(account.type)];
};

/* ------------------------------------------------------------------ *
 * Figures
 *
 * Every account used to read ₹0 with a "No balance" chip while the ledger held
 * three months of spending, and the credit card read ₹2,00,000 — its limit,
 * formatted exactly like money the user had. The backend now derives the real
 * figures (`account.summary`); these helpers decide which one an account leads
 * with, so no screen has to guess.
 *
 * The rule that must not bend: `credit_limit` is only ever a denominator.
 * ------------------------------------------------------------------ */

export type AccountHeadline = {
  label: string;
  amount: number;
  /** Shown instead of the amount when there is genuinely nothing to report. */
  placeholder?: string;
};

export const hasLedgerActivity = (account: Account) => (account.summary?.entries_total ?? 0) > 0;

export const hasOpeningBalance = (account: Account) =>
  typeof account.balance === 'number' && account.balance !== 0;

/**
 * The one money figure an account row leads with: what a card owes, or what
 * everything else has spent so far this month.
 */
export const getAccountHeadline = (account: Account): AccountHeadline => {
  const summary = account.summary;

  if (normalizeAccountType(account.type) === 'credit_card') {
    return { label: 'Outstanding', amount: summary?.outstanding ?? account.balance ?? 0 };
  }

  return {
    label: 'Spent this month',
    amount: summary?.spent_this_month ?? 0,
    placeholder: hasLedgerActivity(account) ? undefined : 'No spend yet',
  };
};

export type CreditUsage = {
  outstanding: number;
  limit: number;
  /** True percentage — can exceed 100. Clamp only the bar, never the number. */
  percent: number;
  /** "₹23,500 of ₹2,00,000 used" */
  label: string;
};

export const getCreditUsage = (account: Account): CreditUsage | null => {
  if (normalizeAccountType(account.type) !== 'credit_card') return null;
  const limit = account.credit_limit ?? 0;
  if (limit <= 0) return null;

  const outstanding = account.summary?.outstanding ?? account.balance ?? 0;
  const percent = account.summary?.credit_utilisation ?? Math.max(0, (outstanding / limit) * 100);
  return {
    outstanding,
    limit,
    percent,
    label: `${formatMoney(outstanding)} of ${formatMoney(limit)} used`,
  };
};

/**
 * Opening balance plus everything logged since. Only exists when the user
 * actually entered an opening balance — otherwise this would be net flow
 * wearing a balance's clothes.
 */
export const getRunningBalance = (account: Account): number | null =>
  typeof account.summary?.running_balance === 'number' ? account.summary.running_balance : null;

/** "Last activity Yesterday", or null for an account nothing has touched. */
export const getLastActivityLabel = (account: Account): string | null =>
  formatRelativeDay(account.summary?.last_activity_date);

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

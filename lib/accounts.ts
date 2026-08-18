import { API_BASE_URL } from './transactions';
import { ApiFieldErrors, readApiError } from './api-error';
import { getClientTimeZone } from './datetime';

/**
 * What an account can prove from its transactions, derived by the backend (see
 * `internal/http/account_summary.go`). Nothing in here is user-entered.
 *
 * Absent on the create/update responses, which return the bare account; the
 * screens re-fetch the list to get figures.
 */
export type AccountSummary = {
    /** Month-to-date: the 1st through today, same window as the dashboard. */
    spent_this_month: number;
    received_this_month: number;
    entries_this_month: number;
    lifetime_spent: number;
    lifetime_received: number;
    entries_total: number;
    /** YYYY-MM-DD of the most recent entry; absent when never used. */
    last_activity_date?: string;
    /** Credit cards only — what is owed. Never `credit_limit`. */
    outstanding?: number;
    /** Credit cards with a limit only. Percent; can exceed 100. */
    credit_utilisation?: number;
    /** Non-card accounts with an opening balance only. */
    running_balance?: number;
    /** Credit cards only. The limit breakdown a card screen leads with. */
    limit?: CardLimitSummary;
    /** Credit cards with at least one priced statement. The bill to pay. */
    current_statement?: CurrentStatementSummary;
};

/**
 * How much of a card is spoken for.
 *
 *     available_limit = credit_limit - outstanding - emi_blocked_principal
 *
 * `outstanding_source` says which side of the card the figure came from.
 * `statement` means the bank told us and the number is exact; `ledger` means
 * the card has no bill yet and this is what Finnri's own transactions imply.
 * Worth surfacing — a card reading from the ledger is under-counting whatever
 * the user has not logged.
 */
export type CardLimitSummary = {
    outstanding: number;
    outstanding_source: 'statement' | 'ledger';
    /** Principal on EMI plans not yet billed to a statement. */
    emi_blocked_principal: number;
    credit_limit: number;
    /** Absent when the user has not entered a limit. Negative when over it. */
    available_limit?: number;
    /** Percent of the limit committed. Can exceed 100. */
    utilisation_pct?: number;
};

/** The bill, as the accounts list needs it. */
export type CurrentStatementSummary = {
    id: number;
    statement_date: string;
    due_date: string;
    total_due: number;
    minimum_due: number;
    paid_amount: number;
    remaining_due: number;
    status: 'draft' | 'unpaid' | 'partial' | 'paid';
    is_overdue: boolean;
    /** Negative once the due date has passed. */
    days_to_due: number;
};

export type Account = {
    id: number;
    type: AccountType;
    name: string;
    color: string;
    provider?: string;
    identifier?: string;
    credit_limit?: number;
    due_day?: number;
    /** Day of month a card bills on. 0 until the first statement infers it. */
    statement_day?: number;
    /** Lead time on the "bill due soon" reminder. */
    reminder_days_before?: number;
    /**
     * Only changes how the due-date reminder is worded. A payment is never
     * recorded without the user confirming it.
     */
    autopay_enabled?: boolean;
    /**
     * Opening balance — what the account held (or, on a card, owed) before the
     * first logged transaction. Read `summary` for anything current.
     */
    balance?: number;
    fee_month?: string;
    is_default?: boolean;
    summary?: AccountSummary;
    created_at?: string;
    updated_at?: string;
};

export type AccountPayload = {
    type: AccountType;
    name: string;
    color: string;
    provider?: string;
    identifier?: string;
    credit_limit?: number;
    due_day?: number;
    statement_day?: number;
    reminder_days_before?: number;
    autopay_enabled?: boolean;
    fee_month?: string;
    balance?: number;
    is_default?: boolean;
};

export type AccountType = 'cash' | 'upi' | 'bank' | 'credit_card' | 'debit_card' | 'wallet' | 'other';

const paymentModeAccountDefaults: Record<string, Pick<AccountPayload, 'type' | 'name' | 'color'>> = {
    Cash: { type: 'cash', name: 'Cash Account', color: '#2ECC71' },
    UPI: { type: 'upi', name: 'UPI Account', color: '#00D2B4' },
    'Credit Card': { type: 'credit_card', name: 'Credit Card Account', color: '#8257E5' },
    Wallets: { type: 'wallet', name: 'Wallet Account', color: '#FF9F43' },
};

export const normalizeAccountType = (type?: string | null): AccountType => {
    const normalized = type?.trim().toLowerCase();
    if (normalized === 'credit') return 'credit_card';
    if (normalized === 'debit') return 'debit_card';
    if (normalized === 'wallets') return 'wallet';
    if (
        normalized === 'cash' ||
        normalized === 'upi' ||
        normalized === 'bank' ||
        normalized === 'credit_card' ||
        normalized === 'debit_card' ||
        normalized === 'wallet'
    ) {
        return normalized;
    }
    return 'other';
};

export const getAccountTypeForPaymentMode = (mode?: string | null) => {
    if (!mode) return null;
    const normalized = mode.trim().toLowerCase();
    if (normalized === 'cash') return 'cash';
    if (normalized === 'upi') return 'upi';
    if (normalized === 'credit card') return 'credit_card';
    if (normalized === 'bank account' || normalized === 'bank') return 'bank';
    if (normalized === 'wallets' || normalized === 'wallet') return 'wallet';
    return null;
};

export const getAccountsForPaymentMode = (accounts: Account[], mode?: string | null) => {
    const accountType = getAccountTypeForPaymentMode(mode);
    if (!accountType) return accounts;
    return accounts.filter((account) => normalizeAccountType(account.type) === accountType);
};

export const getPreferredAccountForPaymentMode = (accounts: Account[], mode?: string | null) => {
    const compatibleAccounts = getAccountsForPaymentMode(accounts, mode);
    return (
        compatibleAccounts.find((account) => account.is_default) ??
        compatibleAccounts[0] ??
        null
    );
};

export const getAutoAccountPayloadForPaymentMode = (mode?: string | null): AccountPayload | null => {
    if (!mode) return null;
    const matchedMode = Object.keys(paymentModeAccountDefaults).find(
        (option) => option.toLowerCase() === mode.trim().toLowerCase(),
    );
    if (!matchedMode) return null;
    return {
        ...paymentModeAccountDefaults[matchedMode],
        provider: '',
        identifier: '',
        credit_limit: 0,
        due_day: 0,
        fee_month: '',
        balance: 0,
        is_default: false,
    };
};

export class AccountApiError extends Error {
    status: number;
    code?: string;
    fields?: ApiFieldErrors;

    constructor(message: string, status: number, code?: string, fields?: ApiFieldErrors) {
        super(message);
        this.name = 'AccountApiError';
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

const accountFieldLabels: Record<string, string> = {
    type: 'Account type',
    name: 'Account name',
    color: 'Color',
    provider: 'Provider',
    identifier: 'Identifier',
    credit_limit: 'Credit limit',
    due_day: 'Due day',
    fee_month: 'Fee month',
    balance: 'Balance',
    is_default: 'Default account',
};

const readAccountError = async (response: Response, fallback: string): Promise<AccountApiError> => {
    const apiError = await readApiError(response, fallback, accountFieldLabels);
    return new AccountApiError(apiError.message, apiError.status, apiError.code, apiError.fields);
};

export const fetchAccounts = async (token: string): Promise<Account[]> => {
    // The same `tz` the dashboard sends, because "this month" has to mean the
    // same month on both tabs — otherwise the two screens disagree about the
    // same account for a few hours either side of a month boundary.
    const query = new URLSearchParams({ tz: getClientTimeZone() });
    const response = await fetch(`${API_BASE_URL}/v1/accounts?${query.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw await readAccountError(response, 'Unable to load accounts right now.');
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
        throw new Error('The accounts response was invalid.');
    }

    return (payload as Account[]).map((account) => ({
        ...account,
        type: normalizeAccountType(account.type),
    }));
};

export const saveAccount = async (token: string, payload: AccountPayload): Promise<Account> => {
    const response = await fetch(`${API_BASE_URL}/v1/accounts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw await readAccountError(response, 'Unable to save account right now.');
    }

    return response.json();
};

export const updateAccount = async (
    token: string,
    accountId: number,
    payload: AccountPayload,
): Promise<Account> => {
    const response = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw await readAccountError(response, 'Unable to update account right now.');
    }
    return response.json();
};

export const deleteAccount = async (token: string, accountId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/v1/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw await readAccountError(response, 'Unable to delete account right now.');
    }
};

export const toAccountPayload = (account: Account): AccountPayload => ({
    type: normalizeAccountType(account.type),
    name: account.name,
    color: account.color,
    provider: account.provider,
    identifier: account.identifier,
    credit_limit: account.credit_limit,
    due_day: account.due_day,
    // Sent back only when known. The server treats these three as
    // leave-as-is when absent, so an edit that says nothing about a card's
    // billing cycle cannot wipe the statement day it inferred from the
    // user's first bill.
    ...(typeof account.statement_day === 'number'
        ? { statement_day: account.statement_day }
        : {}),
    ...(typeof account.reminder_days_before === 'number'
        ? { reminder_days_before: account.reminder_days_before }
        : {}),
    ...(typeof account.autopay_enabled === 'boolean'
        ? { autopay_enabled: account.autopay_enabled }
        : {}),
    fee_month: account.fee_month,
    balance: account.balance,
    is_default: account.is_default,
});

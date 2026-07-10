import { API_BASE_URL } from './transactions';
import { ApiFieldErrors, readApiError } from './api-error';

export type Account = {
    id: number;
    type: string;
    name: string;
    color: string;
    provider?: string;
    identifier?: string;
    credit_limit?: number;
    due_day?: number;
    fee_month?: string;
    balance?: number;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
};

export type AccountPayload = {
    type: string;
    name: string;
    color: string;
    provider?: string;
    identifier?: string;
    credit_limit?: number;
    due_day?: number;
    fee_month?: string;
    balance?: number;
    is_default?: boolean;
};

const paymentModeAccountDefaults: Record<string, Pick<AccountPayload, 'type' | 'name' | 'color'>> = {
    Cash: { type: 'cash', name: 'Cash Account', color: '#2ECC71' },
    UPI: { type: 'upi', name: 'UPI Account', color: '#00D2B4' },
    'Credit Card': { type: 'credit', name: 'Credit Card Account', color: '#8257E5' },
    Wallets: { type: 'wallet', name: 'Wallet Account', color: '#FF9F43' },
};

export const getAccountTypeForPaymentMode = (mode?: string | null) => {
    if (!mode) return null;
    const normalized = mode.trim().toLowerCase();
    if (normalized === 'cash') return 'cash';
    if (normalized === 'upi') return 'upi';
    if (normalized === 'credit card') return 'credit';
    if (normalized === 'wallets' || normalized === 'wallet') return 'wallet';
    return null;
};

export const getAccountsForPaymentMode = (accounts: Account[], mode?: string | null) => {
    const accountType = getAccountTypeForPaymentMode(mode);
    if (!accountType) return accounts;
    return accounts.filter((account) => account.type?.toLowerCase() === accountType);
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
    const response = await fetch(`${API_BASE_URL}/v1/accounts`, {
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

    return payload as Account[];
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
    type: account.type,
    name: account.name,
    color: account.color,
    provider: account.provider,
    identifier: account.identifier,
    credit_limit: account.credit_limit,
    due_day: account.due_day,
    fee_month: account.fee_month,
    balance: account.balance,
    is_default: account.is_default,
});

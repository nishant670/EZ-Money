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

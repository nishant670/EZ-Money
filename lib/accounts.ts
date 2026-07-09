import { API_BASE_URL } from './transactions';

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
};

export const fetchAccounts = async (token: string): Promise<Account[]> => {
    const response = await fetch(`${API_BASE_URL}/v1/accounts`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to load accounts right now.');
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
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to save account right now.');
    }

    return response.json();
};

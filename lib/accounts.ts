import { API_BASE_URL } from './transactions';

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

export const saveAccount = async (token: string, payload: AccountPayload) => {
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

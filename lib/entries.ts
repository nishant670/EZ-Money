import { readApiError } from './api-error';
import { API_BASE_URL, type ApiEntry } from './transactions';

const entryFieldLabels: Record<string, string> = {
  account_id: 'Account',
  amount: 'Amount',
  category: 'Category',
  currency: 'Currency',
  date: 'Date',
  mode: 'Payment method',
  source: 'Source',
  title: 'Title',
  type: 'Transaction type',
};

export type EntryMutationPayload = {
  title: string;
  amount: string;
  currency: string;
  account_id: number | null;
  type: string;
  mode: string;
  category: string;
  notes: string;
  merchant: string;
  tag: string | null;
  date?: string;
  time?: string;
  source?: 'manual' | 'text' | 'voice';
  source_text?: string;
};

const entryHeaders = (token: string, idempotencyKey?: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
});

export const fetchEntry = async (token: string, id: string | number): Promise<ApiEntry> => {
  const response = await fetch(`${API_BASE_URL}/v1/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to load the transaction right now.', entryFieldLabels);
  }
  return response.json();
};

export const createEntry = async (
  token: string,
  payload: EntryMutationPayload,
  idempotencyKey: string
): Promise<ApiEntry> => {
  const response = await fetch(`${API_BASE_URL}/v1/entries`, {
    method: 'POST',
    headers: entryHeaders(token, idempotencyKey),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to save the entry right now.', entryFieldLabels);
  }
  return response.json();
};

export const updateEntry = async (
  token: string,
  id: string | number,
  payload: EntryMutationPayload
): Promise<ApiEntry> => {
  const response = await fetch(`${API_BASE_URL}/v1/entries/${id}`, {
    method: 'PUT',
    headers: entryHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to update the transaction right now.', entryFieldLabels);
  }
  return response.json();
};

export const deleteEntry = async (token: string, id: string | number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/entries/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to delete the transaction right now.', entryFieldLabels);
  }
};

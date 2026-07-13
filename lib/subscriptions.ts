import { API_BASE_URL } from './transactions';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type BillingInterval = 'weekly' | 'monthly' | 'yearly';

export type Subscription = {
  id: number;
  user_id: number;
  account_id?: number | null;
  account?: {
    id: number;
    name: string;
    type: string;
  } | null;
  name: string;
  merchant: string;
  category: string;
  amount: number | string;
  currency: 'INR';
  billing_interval: BillingInterval;
  next_due_date: string;
  last_charged_date?: string;
  status: SubscriptionStatus;
  reminder_days: number;
  notes: string;
  days_until_due: number;
  due_state: 'scheduled' | 'due_soon' | 'overdue' | 'paused' | 'cancelled' | 'unknown';
  created_at: string;
  updated_at: string;
};

export type SubscriptionPayload = {
  name: string;
  merchant?: string;
  category?: string;
  amount: number;
  billing_interval?: BillingInterval;
  next_due_date: string;
  last_charged_date?: string;
  status?: SubscriptionStatus;
  reminder_days?: number;
  notes?: string;
  account_id?: number | null;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const readSubscriptionError = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    if (payload?.fields && typeof payload.fields === 'object') {
      return Object.values(payload.fields).join('\n');
    }
    if (typeof payload?.error === 'string') {
      return payload.error;
    }
  } catch {
    // Ignore invalid error bodies and use the fallback.
  }
  return fallback;
};

export const syncSubscriptionReminders = async (token?: string | null): Promise<number> => {
  if (!token) return 0;
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions/reminders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return 0;
  const payload = await response.json();
  return Number(payload?.created ?? 0);
};

export const fetchSubscriptions = async (
  token?: string | null,
  status: 'all' | SubscriptionStatus = 'all'
): Promise<Subscription[]> => {
  if (!token) return [];
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Unable to load subscriptions right now.');
  }
  const payload = await response.json();
  return Array.isArray(payload) ? (payload as Subscription[]) : [];
};

export const createSubscription = async (
  token: string,
  payload: SubscriptionPayload
): Promise<Subscription> => {
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      currency: 'INR',
      billing_interval: 'monthly',
      status: 'active',
      reminder_days: 3,
      ...payload,
    }),
  });
  if (!response.ok) {
    throw new Error(await readSubscriptionError(response, 'Unable to save this subscription.'));
  }
  return (await response.json()) as Subscription;
};

export const updateSubscription = async (
  token: string,
  id: number,
  payload: SubscriptionPayload
): Promise<Subscription> => {
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      currency: 'INR',
      billing_interval: 'monthly',
      status: 'active',
      reminder_days: 3,
      ...payload,
    }),
  });
  if (!response.ok) {
    throw new Error(await readSubscriptionError(response, 'Unable to update this subscription.'));
  }
  return (await response.json()) as Subscription;
};

export const markSubscriptionPaid = async (
  token: string,
  id: number,
  paidDate: string
): Promise<Subscription> => {
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions/${id}/mark-paid`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ paid_date: paidDate }),
  });
  if (!response.ok) {
    throw new Error(await readSubscriptionError(response, 'Unable to mark this subscription paid.'));
  }
  return (await response.json()) as Subscription;
};

export const deleteSubscription = async (token: string, id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/subscriptions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readSubscriptionError(response, 'Unable to delete this subscription.'));
  }
};

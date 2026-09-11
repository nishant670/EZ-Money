import { readApiError } from './api-error';
import { API_BASE_URL, parseDateLabel, type ApiEntry } from './transactions';

export type RefundStatus = 'pending' | 'received' | 'written_off';

export type RefundableEntry = ApiEntry & {
  id: string | number;
  refundable_amount: number | string;
  refund_expected_on: string;
  refund_status: RefundStatus;
};

export const refundReminderAtNineAM = (dateLabel: string) => {
  const date = parseDateLabel(dateLabel);
  if (!date) return null;
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

export const fetchRefundables = async (
  token: string,
  status: RefundStatus | 'all' = 'pending'
): Promise<RefundableEntry[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/refundables?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to load expected refunds right now.');
  }
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? (payload as RefundableEntry[]) : [];
};

export const updateRefundStatus = async (
  token: string,
  entryID: string | number,
  status: RefundStatus
): Promise<RefundableEntry> => {
  const response = await fetch(`${API_BASE_URL}/v1/refundables/${entryID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to update this refund right now.');
  }
  return response.json();
};

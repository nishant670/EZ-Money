import { API_BASE_URL } from './transactions';

export type MerchantSuggestion = {
  merchant: string;
  category: string;
  transaction_count: number;
  last_seen_date: string;
};

/**
 * Merchants the user has actually logged, most-used first.
 *
 * The subscription sheet types a merchant name that already exists in the
 * ledger nine times out of ten — "Netflix" is in there because the payment was
 * captured last month. Suggesting from the ledger keeps the subscription's
 * merchant spelled the same way as the transactions it will be compared
 * against, which is what makes the recurring detection and the merchant
 * history line up.
 */
export const fetchMerchantSuggestions = async (
  token?: string | null,
  search = '',
  limit = 8
): Promise<MerchantSuggestion[]> => {
  if (!token) return [];
  const params = new URLSearchParams({ limit: String(limit) });
  if (search.trim()) params.append('q', search.trim());
  const response = await fetch(`${API_BASE_URL}/v1/merchants/suggestions?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { suggestions?: MerchantSuggestion[] };
  return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
};

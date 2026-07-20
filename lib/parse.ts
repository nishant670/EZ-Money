import { getClientTimeZone } from './datetime';
import { API_BASE_URL } from './transactions';

export type ParseResponse = {
  type: string | null;
  title: string | null;
  time: string | null;
  amount: number | null;
  currency: string | null;
  mode: string | null;
  card_network: string | null;
  account_hint: string | null;
  category: string | null;
  merchant: string | null;
  tag: string | null;
  tags?: string[];
  note: string | null;
  date: string | null;
  source_text: string | null;
  recurring_candidate?: boolean | null;
  subscription_candidate?: {
    name?: string | null;
    merchant?: string | null;
    category?: string | null;
    amount?: number | null;
    billing_interval?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null;
    next_due_date?: string | null;
    last_charged_date?: string | null;
    reminder_days?: number | null;
    cancel_before_due?: boolean | null;
    notes?: string | null;
    missing_fields?: string[];
  } | null;
  split_candidate?: boolean | null;
  split_candidate_details?: {
    group_name?: string | null;
    participants?: Array<{
      friend_name?: string | null;
      share_amount?: number | null;
      direction?: 'friend_owes_user' | 'user_owes_friend';
    }>;
    missing_fields?: string[];
  } | null;
  confidence?: Record<string, number>;
  needs_confirmation?: Record<string, boolean>;
  missing_fields?: string[];
  clarifications?: string[];
  credits_charged?: number;
  credits_remaining_today?: number;
  credits_remaining_total?: number;
  plan_code?: string;
};

export type ParseDraftInput = {
  token?: string | null;
  hintText?: string;
  audio?: {
    uri: string;
    name: string;
    type: string;
  };
  tz?: string;
};

type ParseErrorPayload = {
  error?: string;
  message?: string;
  required_credits?: number;
  available_credits?: number;
  daily_limit_remaining?: number;
  daily_limit?: number;
  used_today?: number;
  reset_at?: string;
  upgrade_required?: boolean;
};

const parseErrorMessages: Record<string, string> = {
  insufficient_ai_credits: 'Not enough Finnri AI credits for this capture.',
  daily_ai_limit_reached: 'You have reached today’s Finnri AI credit limit.',
  feature_locked: 'This AI feature needs an active plan.',
  guest_not_allowed: 'Create an account to use this AI feature.',
  non_transactional_prompt: 'Tell Finnri about an expense, income, bill, split, subscription, or payment to add.',
  could_not_parse: 'I could not find a clear transaction in that. Try including the amount, merchant, and payment method.',
  schema_invalid: 'I could not turn that into a clean transaction. Try again with the amount, merchant, and payment method.',
};

export class ParseApiError extends Error {
  status: number;
  code?: string;
  requiredCredits?: number;
  availableCredits?: number;
  dailyLimitRemaining?: number;
  dailyLimit?: number;
  usedToday?: number;
  resetAt?: string;
  upgradeRequired?: boolean;

  constructor(payload: ParseErrorPayload, status: number, fallback: string) {
    const code = payload.error;
    super((code && parseErrorMessages[code]) || payload.message || code || fallback);
    this.name = 'ParseApiError';
    this.status = status;
    this.code = code;
    this.requiredCredits = payload.required_credits;
    this.availableCredits = payload.available_credits;
    this.dailyLimitRemaining = payload.daily_limit_remaining;
    this.dailyLimit = payload.daily_limit;
    this.usedToday = payload.used_today;
    this.resetAt = payload.reset_at;
    this.upgradeRequired = payload.upgrade_required;
  }
}

const readParseError = async (response: Response) => {
  const fallback = 'Unable to parse the entry right now.';
  try {
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as ParseErrorPayload) : {};
    return new ParseApiError(payload, response.status, fallback);
  } catch {
    return new ParseApiError({}, response.status, fallback);
  }
};

export const parseEntryDraft = async ({
  token,
  hintText,
  audio,
  tz = getClientTimeZone(),
}: ParseDraftInput): Promise<ParseResponse> => {
  const formData = new FormData();
  const trimmedHint = hintText?.trim() ?? '';
  if (trimmedHint) {
    formData.append('hint_text', trimmedHint);
  }
  if (audio) {
    formData.append('audio', audio as unknown as Blob);
  }
  formData.append('tz', tz);

  const response = await fetch(`${API_BASE_URL}/v1/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) {
    throw await readParseError(response);
  }
  return response.json();
};

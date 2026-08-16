import { getClientTimeZone } from './datetime';
import { API_BASE_URL } from './transactions';

/**
 * What the parse channel came back with.
 *
 * The channel now carries both directions — a capture and a question — and
 * `stage` is the only thing that tells them apart. Everything downstream
 * branches on it: a `ParseAnswer` must never reach the transaction form, and a
 * `ParseDraft` must never reach the answer card.
 */
export type ParseResult = ParseDraft | ParseAnswer;

export type ParseAnswerStatus = 'answered' | 'no_data' | 'unsupported';

export type ParseAnswerMetric =
  | 'spend_total'
  | 'income_total'
  | 'net'
  | 'count'
  | 'average'
  | 'largest'
  | 'breakdown'
  | 'unsupported';

export type ParseAnswerSlice = {
  label: string;
  amount: number;
  transaction_count: number;
  percentage: number;
};

export type LedgerAnswer = {
  status: ParseAnswerStatus;
  metric: ParseAnswerMetric;
  /**
   * Major units, or null for a count and for anything that is not `answered`.
   * The server never formats money — `formatMoney` does, here.
   */
  amount: number | null;
  currency: string;
  transaction_count: number;
  subject: string;
  entry_type?: 'expense' | 'income';
  period: {
    kind: string;
    /** The window in words, shown beside the number so the scope is never implicit. */
    label: string;
    start_date?: string;
    end_date?: string;
  };
  group_by?: 'category' | 'merchant' | 'month' | 'none';
  breakdown: ParseAnswerSlice[];
  largest_entry?: {
    entry_id: number;
    title: string;
    merchant: string;
    category: string;
    amount: number;
    date: string;
  };
  reason?: string;
  /** Server-authored. Shown as written; the model does not write user-facing prose here. */
  message?: string;
  suggestions: string[];
  /**
   * The `GET /v1/entries` parameters the figures were computed over. Handed
   * straight to the transaction list, so the rows behind the answer are the
   * rows it counted.
   */
  filters: Record<string, string>;
};

export type ParseAnswer = {
  stage: 'answer';
  intent: 'question';
  source_text: string | null;
  answer: LedgerAnswer;
  credits_charged?: number;
  credits_remaining_today?: number;
  credits_remaining_total?: number;
  plan_code?: string;
};

export const isParseAnswer = (result: ParseResult): result is ParseAnswer =>
  (result as ParseAnswer).stage === 'answer';

/**
 * A guess at whether typed text is a question, used for **one** thing: deciding
 * whether to open the draft review sheet before the response arrives.
 *
 * The capture sheet opens optimistically so the wait has somewhere to happen,
 * which is right for a capture and wrong for a question — a sheet that appears
 * and then withdraws to reveal an answer reads as a glitch. This lets an
 * obvious question wait behind an inline indicator instead.
 *
 * It has no authority over anything else. The server classifies the intent, and
 * a wrong guess here costs a slightly later sheet or a slightly earlier one —
 * never a draft that is not shown or an answer treated as a transaction.
 */
const questionOpeners =
  /^(how|what|what's|whats|where|when|which|who|why|do i|did i|am i|was i|have i|has|is my|are my|show me|tell me|kitna|kitne)\b/i;

export const looksLikeQuestion = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith('?')) return true;
  return questionOpeners.test(trimmed);
};

export type ParseDraft = {
  stage?: string;
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
    billing_interval?:
      | 'daily'
      | 'business_daily'
      | 'weekly'
      | 'biweekly'
      | 'monthly'
      | 'quarterly'
      | 'yearly'
      | null;
    next_due_date?: string | null;
    last_charged_date?: string | null;
    reminder_days?: number | null;
    cancel_before_due?: boolean | null;
    cancel_on_date?: string | null;
    autopay?: boolean | null;
    payment_mode?: string | null;
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

/** The draft shape, under the name the app has always used for it. */
export type ParseResponse = ParseDraft;

export type ParseDraftInput = {
  token?: string | null;
  hintText?: string;
  audio?: {
    file: Blob;
    name: string;
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
  non_transactional_prompt:
    'Tell Finnri about an expense, income, bill, split, subscription, or payment to add.',
  could_not_parse:
    'I could not find a clear transaction in that. Try including the amount, merchant, and payment method.',
  schema_invalid:
    'I could not turn that into a clean transaction. Try again with the amount, merchant, and payment method.',
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
}: ParseDraftInput): Promise<ParseResult> => {
  const formData = new FormData();
  const trimmedHint = hintText?.trim() ?? '';
  if (trimmedHint) {
    formData.append('hint_text', trimmedHint);
  }
  if (audio) {
    formData.append('audio', audio.file, audio.name);
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

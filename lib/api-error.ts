export type ApiFieldErrors = Record<string, string>;

type ApiErrorPayload = {
  error?: string;
  message?: string;
  fields?: ApiFieldErrors;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: ApiFieldErrors;

  constructor(message: string, status: number, code?: string, fields?: ApiFieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const NETWORK_ERROR_MESSAGE = 'Could not connect to Finnri. Check your internet connection and make sure the app is online.';

const rawNetworkPatterns = [
  /fetch failed/i,
  /network request failed/i,
  /failed to fetch/i,
  /load failed/i,
  /connectexception/i,
  /failed to connect/i,
  /connection refused/i,
  /timed out/i,
  /timeout/i,
  /network is unreachable/i,
  /internet connection appears to be offline/i,
  /could not connect to the server/i,
];

const codeMessages: Record<string, string> = {
  invalid_json: 'The form could not be read. Please check your details and try again.',
  invalid_entry: 'Please fix the highlighted transaction details.',
  invalid_account: 'Please fix the highlighted account details.',
  invalid_filters: 'Please adjust the filters and try again.',
  unauthorized: 'Your session expired. Please sign in again.',
  authorization_header_missing: 'Your session expired. Please sign in again.',
  authorization_header_invalid: 'Your session expired. Please sign in again.',
  invalid_token: 'Your session expired. Please sign in again.',
  invalid_or_expired_session: 'Your session expired. Please sign in again.',
  account_in_use: 'Move or delete linked transactions before deleting this account.',
  last_account: 'Create another account before deleting your only account.',
};

const humanizeField = (field: string) =>
  field
    .replace(/_id$/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const humanizeCode = (code: string) =>
  code.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());

const ensurePunctuation = (value: string) => /[.!?]$/.test(value) ? value : `${value}.`;

const tryReadPayloadMessage = (message: string) => {
  try {
    const payload = JSON.parse(message) as ApiErrorPayload;
    return payload.message || (payload.error ? codeMessages[payload.error] ?? humanizeCode(payload.error) : null);
  } catch {
    return null;
  }
};

export const getFriendlyErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const message = rawMessage.trim();
  if (!message) {
    return fallback;
  }

  if (rawNetworkPatterns.some((pattern) => pattern.test(message))) {
    return NETWORK_ERROR_MESSAGE;
  }

  const payloadMessage = tryReadPayloadMessage(message);
  if (payloadMessage) {
    return payloadMessage;
  }

  if (/^https?:\/\//i.test(message) || /\/\d{1,3}(?:\.\d{1,3}){3}:\d+/.test(message)) {
    return NETWORK_ERROR_MESSAGE;
  }

  return message;
};

export const formatApiFieldErrors = (
  fields: ApiFieldErrors,
  labels: Record<string, string> = {},
) => Object.entries(fields)
  .map(([field, message]) => {
    const label = labels[field] ?? humanizeField(field);
    return ensurePunctuation(`${label} ${message}`);
  });

export const readApiError = async (
  response: Response,
  fallback: string,
  labels: Record<string, string> = {},
): Promise<ApiError> => {
  let payload: ApiErrorPayload | null = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) as ApiErrorPayload : null;
  } catch {
    payload = null;
  }

  const code = payload?.error;
  const fields = payload?.fields;
  const fieldMessages = fields ? formatApiFieldErrors(fields, labels) : [];
  const baseMessage =
    payload?.message ||
    (code ? codeMessages[code] ?? humanizeCode(code) : null) ||
    fallback;
  const message = fieldMessages.length > 0
    ? `${baseMessage}\n${fieldMessages.map((fieldMessage) => `• ${fieldMessage}`).join('\n')}`
    : baseMessage;

  return new ApiError(message, response.status, code, fields);
};

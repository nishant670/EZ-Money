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

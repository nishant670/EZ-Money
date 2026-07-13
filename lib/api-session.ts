import { useAuthStore } from '@/hooks/use-auth-store';

import { API_BASE_URL } from './transactions';

type UnauthorizedHandler = () => void;
type FetchInput = Parameters<typeof fetch>[0] | URL;

let originalFetch: typeof fetch | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

const sessionInvalidationCodes = new Set([
  'authorization_header_missing',
  'authorization_header_invalid',
  'invalid_token',
  'invalid_or_expired_session',
  'invalid_session_user',
]);

const responseHasSessionInvalidationCode = async (response: Response) => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    return typeof payload.error === 'string' && sessionInvalidationCodes.has(payload.error);
  } catch {
    return false;
  }
};

const getRequestUrl = (input: FetchInput) => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const isProtectedApiRequest = (input: FetchInput) => {
  try {
    const requestUrl = new URL(getRequestUrl(input), API_BASE_URL);
    const apiUrl = new URL(API_BASE_URL);

    return (
      requestUrl.origin === apiUrl.origin &&
      requestUrl.pathname.startsWith('/v1/') &&
      !requestUrl.pathname.startsWith('/v1/auth/')
    );
  } catch {
    return false;
  }
};

const readHeaderValue = (headers: HeadersInit | undefined, name: string) => {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const normalizedName = name.toLowerCase();
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === normalizedName);
    return match?.[1] ?? null;
  }

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === normalizedName);
  return match?.[1] ?? null;
};

const getBearerToken = (input: FetchInput, init?: Parameters<typeof fetch>[1]) => {
  const authHeader =
    readHeaderValue(init?.headers, 'Authorization') ??
    (typeof input === 'string' || input instanceof URL
      ? null
      : input.headers.get('Authorization'));

  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const shouldInvalidateSession = (
  input: FetchInput,
  init?: Parameters<typeof fetch>[1],
) => {
  if (!isProtectedApiRequest(input)) {
    return false;
  }

  const requestToken = getBearerToken(input, init);
  const currentToken = useAuthStore.getState().token;
  return !!requestToken && !!currentToken && requestToken === currentToken;
};

const handleUnauthorized = () => {
  if (!unauthorizedHandler || isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;
  unauthorizedHandler();
  setTimeout(() => {
    isHandlingUnauthorized = false;
  }, 0);
};

export const installApiSessionGuard = (handler: UnauthorizedHandler) => {
  unauthorizedHandler = handler;

  if (!originalFetch) {
    originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const response = await originalFetch!(input, init);

      if (
        response.status === 401 &&
        shouldInvalidateSession(input, init) &&
        (await responseHasSessionInvalidationCode(response))
      ) {
        handleUnauthorized();
      }

      return response;
    };
  }

  return () => {
    unauthorizedHandler = null;
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = null;
    }
  };
};

import { API_BASE_URL } from './transactions';

type FetchInput = Parameters<typeof fetch>[0] | URL;
type FetchInit = Parameters<typeof fetch>[1];
type BaseFetch = (input: any, init?: FetchInit) => Promise<Response>;

/**
 * Retrying reads that failed to reach the server.
 *
 * The backend is a single Railway container that idles down, and the first
 * request to reach a cold one either waits out the boot or gives up before it
 * finishes. Nothing in `lib/` set a timeout or tried twice, so one unlucky
 * request on launch painted the whole of Home as "Could not connect to Finnri"
 * — with the container awake by the time the user read it, and a manual "Try
 * again" the only way back.
 *
 * Two rules keep this from being the wrong kind of clever:
 *
 * - **Reads only.** A retried GET costs a duplicate query. A retried POST costs
 *   a duplicate transaction, a second OTP, or a double charge, and a request
 *   that timed out client-side may well have been handled by the server
 *   anyway. Writes get the timeout and no retry.
 * - **Failures to reach the server only.** A 4xx is an answer; asking again
 *   gets the same one. Only a thrown fetch (no response at all) and the
 *   gateway's own 502/503/504 — which on Railway means "the container is not
 *   up yet" rather than "your request was wrong" — are worth repeating.
 */
const MAX_ATTEMPTS = 3;

/** 400ms, then 800ms. Long enough to let a boot progress, short enough to sit through. */
const RETRY_BASE_DELAY_MS = 400;

/**
 * Per attempt, not per call. React Native leaves fetch without a deadline, so a
 * connection that hangs hangs forever and the retry below never gets its turn.
 * Applied to writes too — a write that cannot be retried should still fail in
 * front of the user rather than spin.
 */
const REQUEST_TIMEOUT_MS = 12000;

/** The gateway saying the app never reached, not the API answering. */
const retryableStatuses = new Set([502, 503, 504]);

const readRequestUrl = (input: FetchInput) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const readMethod = (input: FetchInput, init?: FetchInit) => {
  const method =
    init?.method ??
    (typeof input === 'string' || input instanceof URL ? undefined : input.method) ??
    'GET';
  return method.toUpperCase();
};

/**
 * Whether this request is ours to manage. A request to anywhere else — Google's
 * token endpoint during sign-in, an image on a CDN — keeps the platform's own
 * behaviour untouched.
 */
export const isApiRequest = (input: FetchInput) => {
  try {
    return new URL(readRequestUrl(input), API_BASE_URL).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
};

const isRetryableMethod = (method: string) => method === 'GET' || method === 'HEAD';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A signal that aborts when either the caller's does or the deadline passes,
 * plus the cleanup that detaches it. The caller's signal outlives the attempt
 * it was used for, so the listener has to come back off or a long-lived one
 * accumulates a listener per retry.
 */
const withTimeout = (callerSignal: AbortSignal | null | undefined) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);

  if (callerSignal) {
    if (callerSignal.aborted) {
      abort();
    } else {
      callerSignal.addEventListener?.('abort', abort);
    }
  }

  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener?.('abort', abort);
    },
  };
};

export const fetchWithRetry = async (
  baseFetch: BaseFetch,
  input: FetchInput,
  init?: FetchInit,
): Promise<Response> => {
  if (!isApiRequest(input)) {
    return baseFetch(input, init);
  }

  const callerSignal = init?.signal ?? null;
  const attempts = isRetryableMethod(readMethod(input, init)) ? MAX_ATTEMPTS : 1;

  for (let attempt = 1; ; attempt += 1) {
    const isLastAttempt = attempt >= attempts;
    const { signal, release } = withTimeout(callerSignal);

    try {
      const response = await baseFetch(input, { ...init, signal });
      if (isLastAttempt || !retryableStatuses.has(response.status)) {
        return response;
      }
    } catch (error) {
      // A caller that cancelled its own request is not waiting for an answer,
      // and a screen that unmounted must not be kept alive by a retry.
      if (callerSignal?.aborted || isLastAttempt) {
        throw error;
      }
    } finally {
      release();
    }

    await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }
};

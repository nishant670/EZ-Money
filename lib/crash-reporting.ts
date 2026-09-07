import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting.
 *
 * A store rollout is otherwise unobservable: a crash on someone's handset in
 * a release build produces nothing anybody here will ever see. Play's own
 * vitals arrive late, are sampled, and carry no JavaScript stack — which is
 * where a React Native crash almost always is.
 *
 * Everything here is inert until `EXPO_PUBLIC_SENTRY_DSN` is set. That is
 * deliberate: with no DSN, no network call is made and no native reporter is
 * installed, so a build without the variable behaves exactly as it did before
 * this file existed. The config plugin is added on the same condition in
 * `app.config.js`, so the native build is unchanged too.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const isCrashReportingConfigured = dsn.length > 0;

/**
 * Values that would be a privacy problem in a crash report.
 *
 * Finnri holds someone's spending. A breadcrumb or a URL carrying an amount, a
 * merchant, a note or an account identifier is exactly the kind of data that
 * must not leave the device to debug a null pointer.
 */
const SENSITIVE_KEYS = [
  'amount',
  'title',
  'note',
  'notes',
  'merchant',
  'identifier',
  'phone',
  'email',
  'token',
  'claim_token',
  'otp',
  'pin',
  'transcript',
];

const redactValues = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(redactValues);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))
          ? '[redacted]'
          : redactValues(value),
      ])
    );
  }
  return input;
};

export const initCrashReporting = () => {
  if (!isCrashReportingConfigured) return;

  Sentry.init({
    dsn,
    // The release channel is the only way to tell a store rollout's crashes
    // from an internal test build's.
    environment: __DEV__ ? 'development' : (Constants.expoConfig?.extra?.releaseEnv ?? 'production'),
    // Errors are cheap and rare; traces are neither, and nothing here needs
    // performance data yet.
    tracesSampleRate: 0,
    // Session Replay would record the screen of a personal-finance app.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Do not attach the device's IP or any auto-detected identity.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) event.request.data = redactValues(event.request.data);
      if (event.extra) event.extra = redactValues(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = redactValues(event.contexts) as typeof event.contexts;
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) breadcrumb.data = redactValues(breadcrumb.data) as typeof breadcrumb.data;
      // A console breadcrumb in this app is as likely as not to be a
      // transaction being logged during development.
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
  });
};

/**
 * Ties a crash to an account without saying who it belongs to.
 *
 * The uuid is enough to see that one person hit the same crash six times; the
 * email and phone are not sent, so a crash report never becomes a contact
 * record.
 */
export const identifyCrashReportingUser = (uuid: string | null) => {
  if (!isCrashReportingConfigured) return;
  Sentry.setUser(uuid ? { id: uuid } : null);
};

/**
 * Reports something the app handled but should not have had to. Use it where a
 * catch block currently swallows an error the user was shown a friendly
 * message for.
 */
export const reportHandledError = (error: unknown, context?: Record<string, unknown>) => {
  if (!isCrashReportingConfigured) return;
  Sentry.captureException(error, context ? { extra: redactValues(context) as Record<string, unknown> } : undefined);
};

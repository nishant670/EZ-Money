// Jest hoists jest.mock above the imports, so anything the factory closes over
// must be prefixed `mock` to be allowed out of scope.
const mockCaptureException = jest.fn();
const mockSetUser = jest.fn();
const mockInit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  setUser: (...args: unknown[]) => mockSetUser(...args),
}));

const loadModule = (dsn?: string) => {
  jest.resetModules();
  if (dsn) process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  else delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  return require('@/lib/crash-reporting') as typeof import('@/lib/crash-reporting');
};

describe('crash reporting', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    mockInit.mockClear();
    mockCaptureException.mockClear();
    mockSetUser.mockClear();
  });

  afterAll(() => {
    if (originalDsn) process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    else delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  // Without a DSN nothing may reach the network and no reporter may install,
  // so a build that has not been given one behaves as it did before crash
  // reporting existed.
  it('is completely inert without a DSN', () => {
    const module = loadModule();
    expect(module.isCrashReportingConfigured).toBe(false);

    module.initCrashReporting();
    module.identifyCrashReportingUser('uuid-1');
    module.reportHandledError(new Error('boom'), { amount: 500 });

    expect(mockInit).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('initialises once a DSN is configured', () => {
    const module = loadModule('https://key@o0.ingest.sentry.io/0');
    module.initCrashReporting();
    expect(mockInit).toHaveBeenCalledTimes(1);

    const options = mockInit.mock.calls[0][0];
    // Finnri holds someone's spending. Screen recording and auto-collected
    // identity are both the wrong trade for debugging a null pointer.
    expect(options.sendDefaultPii).toBe(false);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
  });

  // A crash report must never become a record of what someone spent.
  it('redacts money and identity out of handled-error context', () => {
    const module = loadModule('https://key@o0.ingest.sentry.io/0');
    module.reportHandledError(new Error('save failed'), {
      amount: 2499,
      merchant: 'Blue Tokai',
      note: 'coffee with Priya',
      email: 'someone@example.com',
      screen: 'transactions',
      nested: { pin: '1234', accountIdentifier: '4111', harmless: 'ok' },
    });

    const extra = mockCaptureException.mock.calls[0][1].extra;
    expect(extra.amount).toBe('[redacted]');
    expect(extra.merchant).toBe('[redacted]');
    expect(extra.note).toBe('[redacted]');
    expect(extra.email).toBe('[redacted]');
    expect(extra.nested.pin).toBe('[redacted]');
    expect(extra.nested.accountIdentifier).toBe('[redacted]');
    // Redaction has to stop somewhere useful, or a report says nothing.
    expect(extra.screen).toBe('transactions');
    expect(extra.nested.harmless).toBe('ok');
  });

  it('drops console breadcrumbs, which in this app carry transactions', () => {
    const module = loadModule('https://key@o0.ingest.sentry.io/0');
    module.initCrashReporting();
    const { beforeBreadcrumb } = mockInit.mock.calls[0][0];
    expect(beforeBreadcrumb({ category: 'console', message: 'entry saved 2499' })).toBeNull();
    expect(beforeBreadcrumb({ category: 'navigation' })).not.toBeNull();
  });

  it('identifies a user by uuid and nothing else', () => {
    const module = loadModule('https://key@o0.ingest.sentry.io/0');
    module.identifyCrashReportingUser('uuid-42');
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'uuid-42' });
    module.identifyCrashReportingUser(null);
    expect(mockSetUser).toHaveBeenLastCalledWith(null);
  });
});

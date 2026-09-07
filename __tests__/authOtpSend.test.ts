import fs from 'fs';
import path from 'path';

import {
  AuthOtpSendError,
  authOtpSend,
  EMAIL_LOGIN_ENABLED,
  PHONE_IDENTIFIER_ENABLED,
} from '@/lib/auth';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('authOtpSend', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the send receipt on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, { message: 'otp_sent', expires_at: '2026-09-04T10:00:00Z', channel: 'email' }),
    ) as unknown as typeof fetch;

    await expect(authOtpSend('a@example.com')).resolves.toMatchObject({
      message: 'otp_sent',
      channel: 'email',
    });
  });

  // Before delivery existed, every failure below collapsed into the single
  // string "Failed to send OTP", which told a user nothing about whether
  // waiting, switching channel, or retrying was the thing to do.
  it('explains a provider failure without blaming the user', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(502, { error: 'otp_send_failed', channel: 'email' }),
    ) as unknown as typeof fetch;

    await expect(authOtpSend('a@example.com')).rejects.toMatchObject({
      code: 'otp_send_failed',
      message: 'We could not send your code just now. Please try again in a moment.',
    });
  });

  it('carries the retry window out of a throttled resend', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(429, { error: 'otp_resend_too_soon', retry_after_seconds: 42 }),
    ) as unknown as typeof fetch;

    const error = await authOtpSend('a@example.com').catch((caught) => caught);
    expect(error).toBeInstanceOf(AuthOtpSendError);
    expect(error.code).toBe('otp_resend_too_soon');
    expect(error.retryAfterSeconds).toBe(42);
  });

  it('falls back to the Retry-After header when the body omits the window', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(429, { error: 'otp_resend_too_soon' }, { 'Retry-After': '17' }),
    ) as unknown as typeof fetch;

    const error = await authOtpSend('a@example.com').catch((caught) => caught);
    expect(error.retryAfterSeconds).toBe(17);
  });

  it('names email as the way in when a phone number is refused', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(422, { error: 'otp_channel_unavailable', available_channels: ['email'] }),
    ) as unknown as typeof fetch;

    await expect(authOtpSend('9876543210')).rejects.toMatchObject({
      code: 'otp_channel_unavailable',
      message: 'Codes by SMS are not available yet. Please sign in with an email address instead.',
    });
  });

  it('survives a gateway error that is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    ) as unknown as typeof fetch;

    const error = await authOtpSend('a@example.com').catch((caught) => caught);
    expect(error).toBeInstanceOf(AuthOtpSendError);
    expect(error.message).not.toContain('<html>');
  });

  // The client flag and the backend's OTP_PHONE_CHANNEL_ENABLED have to agree.
  // If this ever fails, the app is offering a signup route the server refuses.
  it('keeps the phone identifier switched off while SMS is unwired', () => {
    expect(PHONE_IDENTIFIER_ENABLED).toBe(false);
  });

  it('renders the disabled gate as a route onward, not as a failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(503, { error: 'otp_sign_in_disabled', available_channels: ['google', 'guest'] }),
    ) as unknown as typeof fetch;

    await expect(authOtpSend('a@example.com')).rejects.toMatchObject({
      code: 'otp_sign_in_disabled',
      message: 'Sign in with Google, or keep going as a guest.',
    });
  });
});

describe('sign-in policy', () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(path.resolve(__dirname, '..'), relativePath), 'utf8');

  // Google and guest are the two doors in for launch. The backend refuses OTP
  // with AUTH_OTP_ENABLED=false, so any screen still offering email or a phone
  // number walks someone into a 503 on a screen they cannot get past.
  it('keeps email sign-in switched off', () => {
    expect(EMAIL_LOGIN_ENABLED).toBe(false);
  });

  it.each([
    ['components/auth/AuthScreen1.tsx', 'the welcome screen'],
    ['app/auth.tsx', 'the auth flow'],
    ['app/edit-profile.tsx', 'the profile editor'],
  ])('gates %s behind the flag', (file) => {
    expect(read(file)).toContain('EMAIL_LOGIN_ENABLED');
  });
});

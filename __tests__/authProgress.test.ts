import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearAuthProgress,
  loadAuthProgress,
  previousAuthStep,
  saveAuthProgress,
} from '@/lib/auth-progress';

const PROGRESS_KEY = 'finnri_auth_progress';
const NOW = Date.parse('2026-08-12T10:00:00.000Z');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('auth progress', () => {
  it('survives a round trip so a verified OTP is not asked for twice', async () => {
    await saveAuthProgress({
      step: 'signup-security',
      identifier: 'user@example.com',
      claimToken: 'fnrct_abc',
      claimTokenExpiresAt: NOW + 60_000,
    });

    expect(await loadAuthProgress(NOW)).toEqual({
      step: 'signup-security',
      identifier: 'user@example.com',
      claimToken: 'fnrct_abc',
      claimTokenExpiresAt: NOW + 60_000,
    });
  });

  it('drops a step that cannot proceed without a live claim token', async () => {
    await saveAuthProgress({
      step: 'signup-security',
      identifier: 'user@example.com',
      claimToken: 'fnrct_abc',
      claimTokenExpiresAt: NOW - 1,
    });

    // Resuming onto the PIN screen with a dead token would collect a PIN and
    // then fail the registration behind it.
    expect(await loadAuthProgress(NOW)).toBeNull();
    expect(await AsyncStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('keeps an earlier step but forgets the expired token', async () => {
    await saveAuthProgress({
      step: 'signup-otp',
      identifier: '9876543210',
      claimToken: 'fnrct_stale',
      claimTokenExpiresAt: NOW - 1,
    });

    expect(await loadAuthProgress(NOW)).toEqual({
      step: 'signup-otp',
      identifier: '9876543210',
      claimToken: null,
      claimTokenExpiresAt: null,
    });
  });

  it('stores nothing for the steps there is no point resuming into', async () => {
    await saveAuthProgress({
      step: 'welcome',
      identifier: '',
      claimToken: null,
      claimTokenExpiresAt: null,
    });
    expect(await AsyncStorage.getItem(PROGRESS_KEY)).toBeNull();

    await saveAuthProgress({
      step: 'signup-done',
      identifier: 'user@example.com',
      claimToken: null,
      claimTokenExpiresAt: null,
    });
    expect(await AsyncStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('discards junk rather than resuming into it', async () => {
    await AsyncStorage.setItem(PROGRESS_KEY, 'not json');
    expect(await loadAuthProgress(NOW)).toBeNull();

    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ step: 'nonsense', identifier: 'a' }));
    expect(await loadAuthProgress(NOW)).toBeNull();

    // A step with no identifier cannot resend a code or register anything.
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ step: 'signup-otp', identifier: '' }));
    expect(await loadAuthProgress(NOW)).toBeNull();
  });

  it('clears on request', async () => {
    await saveAuthProgress({
      step: 'identifier',
      identifier: 'user@example.com',
      claimToken: null,
      claimTokenExpiresAt: null,
    });
    await clearAuthProgress();
    expect(await loadAuthProgress(NOW)).toBeNull();
  });

  it('walks Back to the previous step rather than out of the app', () => {
    expect(previousAuthStep('identifier')).toBe('welcome');
    expect(previousAuthStep('signup-otp')).toBe('identifier');
    expect(previousAuthStep('signup-security')).toBe('signup-otp');
    expect(previousAuthStep('existing-account')).toBe('identifier');
    expect(previousAuthStep('pin-login')).toBe('identifier');
    expect(previousAuthStep('otp-login')).toBe('identifier');
    expect(previousAuthStep('reset-otp')).toBe('pin-login');
    expect(previousAuthStep('reset-pin')).toBe('pin-login');
  });

  it('leaves Back alone where there is nothing behind the screen', () => {
    // Welcome is the first screen; the other two are past the point of return.
    expect(previousAuthStep('welcome')).toBeNull();
    expect(previousAuthStep('signup-done')).toBeNull();
    expect(previousAuthStep('otp-login-security')).toBeNull();
  });
});

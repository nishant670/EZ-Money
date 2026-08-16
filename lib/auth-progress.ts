import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The signup flow's steps, as names rather than indices. The value is written to
 * disk after every completed step, so it has to stay stable across releases —
 * a number would silently mean something else the moment a screen is inserted.
 */
export type AuthStep =
  | 'welcome'
  | 'identifier'
  | 'existing-account'
  | 'signup-otp'
  | 'signup-security'
  | 'signup-done'
  | 'pin-login'
  | 'otp-login'
  | 'otp-login-security'
  | 'reset-otp'
  | 'reset-pin';

/**
 * What a half-finished signup is worth resuming from. The claim token is the
 * whole point: it is the proof that the OTP was answered, and losing it to a
 * backgrounded app is what made users re-verify from the Welcome screen.
 */
export type AuthProgress = {
  step: AuthStep;
  identifier: string;
  claimToken: string | null;
  /** Epoch ms. The server expires claim tokens; a stale one resumes to a dead end. */
  claimTokenExpiresAt: number | null;
};

/**
 * Where Back goes from each step. Hardware Back used to fall through to the
 * navigator, which exits the app from what looks like the middle of a form —
 * one stray gesture and a half-finished signup is gone.
 *
 * `null` means Back is not this flow's business: the Welcome screen has nothing
 * behind it, and the two terminal screens must not walk backwards into a flow
 * that has already completed.
 */
const BACK_STEP: Record<AuthStep, AuthStep | null> = {
  welcome: null,
  identifier: 'welcome',
  'existing-account': 'identifier',
  'signup-otp': 'identifier',
  'signup-security': 'signup-otp',
  'signup-done': null,
  'pin-login': 'identifier',
  'otp-login': 'identifier',
  'otp-login-security': null,
  'reset-otp': 'pin-login',
  'reset-pin': 'pin-login',
};

export const previousAuthStep = (step: AuthStep): AuthStep | null => BACK_STEP[step];

const AUTH_PROGRESS_KEY = 'finnri_auth_progress';

/**
 * Steps worth restoring. Anything else is either the start of the flow (nothing
 * to restore) or a terminal celebration (nothing left to do), and resuming into
 * them would be worse than starting over.
 */
const RESUMABLE_STEPS: readonly AuthStep[] = [
  'identifier',
  'existing-account',
  'signup-otp',
  'signup-security',
  'pin-login',
  'otp-login',
  'otp-login-security',
  'reset-otp',
  'reset-pin',
];

/**
 * Steps that cannot be resumed without a live claim token. Restoring
 * `signup-security` with an expired token would show the PIN screen and then
 * fail the registration behind it, which is the worst of both.
 */
const STEPS_REQUIRING_CLAIM_TOKEN: readonly AuthStep[] = [
  'signup-security',
  'otp-login-security',
  'reset-pin',
];

const isAuthStep = (value: unknown): value is AuthStep =>
  typeof value === 'string' && (RESUMABLE_STEPS as readonly string[]).includes(value);

export const saveAuthProgress = async (progress: AuthProgress) => {
  if (!RESUMABLE_STEPS.includes(progress.step)) {
    await clearAuthProgress();
    return;
  }
  try {
    await AsyncStorage.setItem(AUTH_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Progress is a convenience, not a correctness requirement. A storage
    // failure means the user re-verifies; it must not break the flow in hand.
  }
};

export const clearAuthProgress = async () => {
  try {
    await AsyncStorage.removeItem(AUTH_PROGRESS_KEY);
  } catch {
    // Same reasoning as above.
  }
};

export const loadAuthProgress = async (now = Date.now()): Promise<AuthProgress | null> => {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(AUTH_PROGRESS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: Partial<AuthProgress>;
  try {
    parsed = JSON.parse(raw) as Partial<AuthProgress>;
  } catch {
    void clearAuthProgress();
    return null;
  }

  if (!isAuthStep(parsed.step) || typeof parsed.identifier !== 'string' || !parsed.identifier) {
    void clearAuthProgress();
    return null;
  }

  const claimTokenExpiresAt =
    typeof parsed.claimTokenExpiresAt === 'number' ? parsed.claimTokenExpiresAt : null;
  const claimTokenIsLive =
    typeof parsed.claimToken === 'string' &&
    !!parsed.claimToken &&
    claimTokenExpiresAt !== null &&
    claimTokenExpiresAt > now;

  if (!claimTokenIsLive && STEPS_REQUIRING_CLAIM_TOKEN.includes(parsed.step)) {
    void clearAuthProgress();
    return null;
  }

  return {
    step: parsed.step,
    identifier: parsed.identifier,
    claimToken: claimTokenIsLive ? (parsed.claimToken as string) : null,
    claimTokenExpiresAt: claimTokenIsLive ? claimTokenExpiresAt : null,
  };
};

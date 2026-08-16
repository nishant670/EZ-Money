import { act, renderHook } from '@testing-library/react-native';

import { resetDismissedPaywalls, useEntitlementGate } from '@/hooks/use-entitlement-gate';
import { ApiError, entitlementFromError, readApiError } from '@/lib/api-error';

const jsonResponse = (status: number, body: unknown) =>
  ({
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

/** The exact payload `ensureEntitlement` returns for a locked budgets read. */
const budgetsPaywall = {
  error: 'payment_required',
  feature_code: 'budgets',
  feature_label: 'Budgets',
  required_plan: 'paid',
  required_entitlement: 'budgets',
  upgrade_required: true,
};

describe('entitlement responses', () => {
  it('carries the 402 payload through instead of discarding it', async () => {
    const error = await readApiError(
      jsonResponse(402, budgetsPaywall),
      'Unable to load budgets right now.'
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(402);
    expect(entitlementFromError(error)).toEqual({
      featureCode: 'budgets',
      featureLabel: 'Budgets',
      requiredPlan: 'paid',
      upgradeRequired: true,
    });
  });

  it('never surfaces the raw fallback or the error code as the message', async () => {
    const error = await readApiError(
      jsonResponse(402, budgetsPaywall),
      'Unable to load budgets right now.'
    );

    expect(error.message).not.toContain('Unable to load');
    expect(error.message).not.toContain('payment_required');
    expect(error.message).toBe('Budgets is on the paid plan.');
  });

  it('treats a 403 feature_locked as the same paywall', async () => {
    const error = await readApiError(
      jsonResponse(403, {
        error: 'feature_locked',
        feature_code: 'split_ledger',
        feature_label: 'Split ledger',
      }),
      'Unable to load split data.'
    );

    // `feature_locked` omits `upgrade_required`; the plan is still the way through.
    expect(entitlementFromError(error)?.upgradeRequired).toBe(true);
    expect(entitlementFromError(error)?.featureLabel).toBe('Split ledger');
  });

  it('names the feature from required_entitlement when the label is missing', async () => {
    const error = await readApiError(
      jsonResponse(402, { error: 'payment_required', required_entitlement: 'weekly_review' }),
      'Unable to load the review.'
    );

    expect(entitlementFromError(error)?.featureLabel).toBe('Weekly review');
  });

  it('leaves the AI credit 402 alone — a spent allowance is not a locked feature', async () => {
    const error = await readApiError(
      jsonResponse(402, {
        error: 'insufficient_ai_credits',
        required_credits: 2,
        available_credits: 0,
        upgrade_required: true,
      }),
      'Unable to parse the entry right now.'
    );

    expect(entitlementFromError(error)).toBeNull();
  });

  it('leaves genuine failures alone', async () => {
    const error = await readApiError(
      jsonResponse(500, { error: 'entitlement_check_failed' }),
      'Unable to load budgets right now.'
    );

    expect(entitlementFromError(error)).toBeNull();

    expect(entitlementFromError(new Error('Network request failed'))).toBeNull();
    expect(entitlementFromError(null)).toBeNull();
  });
});

describe('paywall dismissal scope', () => {
  const lockedError = () =>
    readApiError(jsonResponse(402, budgetsPaywall), 'Unable to load budgets right now.');

  it('survives a remount, because the Money tab unmounts inactive segments', async () => {
    const error = await lockedError();
    resetDismissedPaywalls();

    const first = await renderHook(() => useEntitlementGate());
    await act(async () => {
      first.result.current.capture(error);
    });
    expect(first.result.current.sheetVisible).toBe(true);

    await act(async () => {
      first.result.current.dismiss();
    });
    expect(first.result.current.sheetVisible).toBe(false);

    // Switching segments away and back remounts the panel — a fresh gate, with
    // no memory of its own. The paywall must not come back up on a single tap.
    const second = await renderHook(() => useEntitlementGate());
    await act(async () => {
      second.result.current.capture(error);
    });
    expect(second.result.current.locked).toBe(true);
    expect(second.result.current.sheetVisible).toBe(false);
  });

  it('asks the next account on its own merits', async () => {
    const error = await lockedError();
    resetDismissedPaywalls();

    const gate = await renderHook(() => useEntitlementGate());
    await act(async () => {
      gate.result.current.capture(error);
    });
    await act(async () => {
      gate.result.current.dismiss();
    });
    expect(gate.result.current.sheetVisible).toBe(false);

    // Logging out clears the set.
    resetDismissedPaywalls();
    await act(async () => {
      gate.result.current.capture(error);
    });
    expect(gate.result.current.sheetVisible).toBe(true);
  });
});

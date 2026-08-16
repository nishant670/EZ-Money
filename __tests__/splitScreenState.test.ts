import { splitScreenState } from '@/lib/splits';

const state = (over: Partial<Parameters<typeof splitScreenState>[0]> = {}) =>
  splitScreenState({ loading: false, loadFailed: false, hasData: false, ...over });

describe('what the Splits screen is entitled to draw', () => {
  it('never dresses a failed load up as an empty account', () => {
    // The bug: five empty collections read as "no groups yet", so the screen
    // offered "Overall, settled up" and a New group button to a user whose
    // groups simply had not arrived.
    expect(state({ loadFailed: true })).toBe('unavailable');
  });

  it('keeps the ledger when a refresh fails on top of it', () => {
    // Figures already on screen are real. Stale beats blank, and blanking them
    // would punish the user for a network blip they can already see explained.
    expect(state({ loadFailed: true, hasData: true })).toBe('ledger');
  });

  it('shows the skeleton only while there is nothing to show yet', () => {
    expect(state({ loading: true })).toBe('loading');
    // A background refresh over existing data must not blank it either.
    expect(state({ loading: true, hasData: true })).toBe('ledger');
  });

  it('treats a genuinely empty account as a ledger, not a failure', () => {
    // Nothing wrong here — the per-section empty states take it from here,
    // and they are the ones that know whether a search filter is on.
    expect(state()).toBe('ledger');
  });
});

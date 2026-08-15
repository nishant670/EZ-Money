import { useCallback, useRef, useState } from 'react';

import { entitlementFromError, type Entitlement } from '@/lib/api-error';

const keyFor = (entitlement: Entitlement) => entitlement.featureCode ?? entitlement.featureLabel;

/**
 * Dismissals live for the session, not for the mount.
 *
 * This was a `useRef` per screen, which held while Budgets was a pushed route
 * — you saw the paywall once per visit and visits were rare. In the Money tab
 * only the active segment is mounted, so a glance at Upcoming and back
 * unmounted the panel, reset the ref, and threw the paywall up again on a
 * single tap. "I have already said no to this" is a fact about the person, not
 * about a component instance.
 */
const dismissedPaywalls = new Set<string>();

/** Called when auth is cleared — the next account gets asked on its own merits. */
export const resetDismissedPaywalls = () => dismissedPaywalls.clear();

/**
 * The one handler for a `402`. Point every catch block on a gated endpoint at
 * `capture` — it returns true when the response was an entitlement rather than
 * a failure, which is the screen's signal to show the paywall and skip its
 * error state entirely.
 *
 *   } catch (loadError) {
 *     if (capture(loadError)) return;
 *     setError(getFriendlyErrorMessage(loadError, '…'));
 *   }
 *
 * Then render `<UpgradeSheet visible={sheetVisible} entitlement={entitlement} onClose={dismiss} />`.
 *
 * `capture`, `present`, `dismiss` and `clear` are stable for the life of the
 * screen, so they are safe in a `useCallback` dependency list — which matters,
 * because these screens reload from `useFocusEffect`.
 */
export function useEntitlementGate() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const currentRef = useRef<Entitlement | null>(null);

  const capture = useCallback((error: unknown) => {
    const found = entitlementFromError(error);
    if (!found) {
      return false;
    }
    currentRef.current = found;
    setEntitlement(found);
    if (!dismissedPaywalls.has(keyFor(found))) {
      setSheetVisible(true);
    }
    return true;
  }, []);

  /** Show the paywall for the entitlement already captured — the locked CTA. */
  const present = useCallback(() => {
    if (currentRef.current) {
      setSheetVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (currentRef.current) {
      dismissedPaywalls.add(keyFor(currentRef.current));
    }
    setSheetVisible(false);
  }, []);

  /** Entitlement granted, or the screen moved on — drop the locked state. */
  const clear = useCallback(() => {
    currentRef.current = null;
    setEntitlement(null);
    setSheetVisible(false);
  }, []);

  return {
    entitlement,
    locked: entitlement !== null,
    sheetVisible,
    capture,
    present,
    dismiss,
    clear,
  };
}

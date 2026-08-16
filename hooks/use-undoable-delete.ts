import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A delete the user can still take back, because it has not happened yet.
 *
 * ## Why the request waits instead of being reversed
 *
 * The obvious shape for Undo is: delete now, and re-create if the user changes
 * their mind. Against this backend that is not a reversal. `DELETE
 * /v1/entries/:id` is a hard delete — the model carries no `deleted_at`, the
 * handler drops the row inside a transaction, removes its split bills, and then
 * unlinks the receipt file from disk. Putting it back would mean POSTing a new
 * entry: a different id, no receipt, no splits, and a `created_at` of now. The
 * screen would look restored while the ledger quietly disagreed about when the
 * money moved.
 *
 * So the "already sent" case is designed out rather than implemented badly.
 * Nothing goes to the server while the window is open; Undo drops the intent
 * and there is nothing to reverse.
 *
 * ## What that trades into, and why it is flushed rather than abandoned
 *
 * The failure this could introduce is the opposite one — a delete the user
 * asked for, watched happen, and that never actually happened because they
 * left. So an interruption *commits*: backgrounding the app or unmounting the
 * screen sends the pending delete immediately. The user's last stated intent
 * was delete, and only Undo says otherwise.
 *
 * ## One at a time
 *
 * A second delete inside the window commits the first rather than queueing it.
 * An Undo that could mean either of two rows is worse than no Undo, and a toast
 * can only name one of them.
 */

/**
 * How long the row can still come back. A reading-and-deciding time rather than
 * a curve, so it is a constant and not a `Motion` token — the same reasoning
 * that keeps Home's save-toast dwell out of the token set. It is also the whole
 * safety margin: this is how long the screen and the ledger are allowed to
 * disagree.
 */
export const UNDO_WINDOW_MS = 5000;

export type UndoableDelete<T> = {
  /** The row on its way out, or `null`. Render it collapsed, not removed. */
  pending: T | null;
  /** Start the window. Commits any delete already waiting. */
  request: (item: T) => void;
  /** Take it back. The only thing that stops the commit. */
  undo: () => void;
  /** Send it now. Safe to call when there is nothing pending, and twice. */
  commit: () => void;
};

export function useUndoableDelete<T>(onCommit: (item: T) => void): UndoableDelete<T> {
  const [pending, setPending] = useState<T | null>(null);
  /**
   * The same intent in a form that can be read and cleared inside one tick.
   * Three things can commit — the timer, the screen going away, the app
   * backgrounding — and two of them can land together. State read from a render
   * scope would still be non-null for the second caller, and the row would be
   * deleted twice.
   */
  const pendingRef = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The caller's commit closes over a token and a setter and is rebuilt every
   * render. The flush paths have to reach the *current* one without
   * re-subscribing — a listener that tears down and rebuilds on each keystroke
   * is a listener that will eventually miss the background event it exists for.
   */
  const commitFn = useRef(onCommit);
  commitFn.current = onCommit;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const commit = useCallback(() => {
    const target = pendingRef.current;
    if (!target) return;
    pendingRef.current = null;
    clearTimer();
    setPending(null);
    commitFn.current(target);
  }, []);

  const request = useCallback(
    (item: T) => {
      commit();
      pendingRef.current = item;
      setPending(item);
      timer.current = setTimeout(commit, UNDO_WINDOW_MS);
    },
    [commit]
  );

  const undo = useCallback(() => {
    pendingRef.current = null;
    clearTimer();
    setPending(null);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') commit();
    });
    return () => {
      subscription.remove();
      commit();
    };
  }, [commit]);

  return { pending, request, undo, commit };
}

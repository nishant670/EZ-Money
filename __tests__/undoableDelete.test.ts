import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { UNDO_WINDOW_MS, useUndoableDelete } from '@/hooks/use-undoable-delete';

type Row = { id: string };

const chai: Row = { id: 'chai' };
const rent: Row = { id: 'rent' };

/** The listener the hook registered, so a test can background the app. */
let appStateListener: ((state: string) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    listener: (state: string) => void
  ) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useUndoableDelete', () => {
  it('holds the request back for the whole window', async () => {
    const commit = jest.fn();
    const { result } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));

    // The row is on its way out on screen, and nothing has reached the server.
    expect(result.current.pending).toBe(chai);
    expect(commit).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    });
    expect(commit).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(chai);
    expect(result.current.pending).toBeNull();
  });

  it('cancels outright rather than reversing', async () => {
    const commit = jest.fn();
    const { result } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));
    await act(async () => result.current.undo());

    expect(result.current.pending).toBeNull();

    // Nothing was ever sent, so there is nothing to put back. This is the whole
    // reason the call waits — see the note on the hook.
    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits the first delete when a second one is asked for', async () => {
    const commit = jest.fn();
    const { result } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));
    await act(async () => result.current.request(rent));

    // An Undo that could mean either row is worse than no Undo.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(chai);
    expect(result.current.pending).toBe(rent);

    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    expect(commit).toHaveBeenLastCalledWith(rent);
  });

  it('commits when the app goes to the background', async () => {
    const commit = jest.fn();
    const { result } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));
    await act(async () => appStateListener?.('background'));

    // The user asked for this and watched it happen. Leaving is not a retraction.
    expect(commit).toHaveBeenCalledWith(chai);
    expect(result.current.pending).toBeNull();
  });

  it('commits when the screen goes away', async () => {
    const commit = jest.fn();
    const { result, unmount } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));
    await act(async () => {
      unmount();
    });

    expect(commit).toHaveBeenCalledWith(chai);
  });

  it('sends one delete however many things fire at once', async () => {
    const commit = jest.fn();
    const { result, unmount } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.request(chai));
    // Backgrounding and unmounting land together often enough — the phone locks
    // as the screen is being popped. Reading the pending row from state rather
    // than a ref would delete it twice.
    await act(async () => appStateListener?.('background'));
    await act(async () => {
      unmount();
    });
    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is nothing waiting', async () => {
    const commit = jest.fn();
    const { result } = await renderHook(() => useUndoableDelete<Row>(commit));

    await act(async () => result.current.commit());
    await act(async () => result.current.undo());

    expect(commit).not.toHaveBeenCalled();
  });

  it('uses the caller its screen has now, not the one it mounted with', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await renderHook(
      ({ onCommit }: { onCommit: (row: Row) => void }) => useUndoableDelete<Row>(onCommit),
      { initialProps: { onCommit: first } }
    );

    await act(async () => result.current.request(chai));
    // A screen rebuilds this closure on every render — over a token refresh, a
    // filter change, a keystroke. The window has to end in the current one.
    await act(async () => rerender({ onCommit: second }));
    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(chai);
  });
});

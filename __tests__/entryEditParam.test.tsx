import { act, renderHook } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

/**
 * The `edit=1` gate from `app/entry/[id].tsx`, extracted so the ordering it
 * depends on can be asserted without mounting the whole detail screen.
 *
 * ## Why the fourth condition exists
 *
 * C5's Edit action pushes `/entry/[id]?edit=1` and expects the sheet to be up
 * when the screen lands. Without `pushSettled` it opened the sheet the instant
 * the fetch resolved — which reliably falls *inside* the native stack's push
 * animation, and a Reanimated spring started while the screen it lives on is
 * still being animated in is lost: `visible` goes true, the modal mounts, and
 * the panel stays parked off the bottom of the screen. The symptom is a detail
 * screen with an invisible sheet on top of it, and it is what every tap on Edit
 * did until C9's device pass ran one.
 *
 * Neither `tsc` nor a render test can see that — the state is set correctly in
 * both worlds. What is assertable is the *gate*, which is what this pins.
 */
function useEditGate({
  edit,
  transaction,
  isLoading,
  pushSettled,
}: {
  edit?: string;
  transaction: unknown;
  isLoading: boolean;
  pushSettled: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (edit === '1' && transaction && !isLoading && pushSettled) {
      setOpen(true);
    }
  }, [edit, isLoading, pushSettled, transaction]);

  return open;
}

const settled = {
  edit: '1',
  transaction: { id: 1 },
  isLoading: false,
  pushSettled: true,
};

describe('the edit sheet waits for the push to finish', () => {
  it('opens once every condition holds', async () => {
    const { result } = await renderHook(() => useEditGate(settled));

    expect(result.current).toBe(true);
  });

  it('stays shut while the screen is still being pushed', async () => {
    // The case that was broken: data has arrived, loading is done, and the
    // sheet would have opened into a running screen transition.
    const { result } = await renderHook(() => useEditGate({ ...settled, pushSettled: false }));

    expect(result.current).toBe(false);
  });

  it('opens when the push lands after the data', async () => {
    const { result, rerender } = await renderHook(
      (props: Parameters<typeof useEditGate>[0]) => useEditGate(props),
      { initialProps: { ...settled, pushSettled: false } }
    );

    expect(result.current).toBe(false);

    await act(async () => {
      rerender(settled);
    });

    expect(result.current).toBe(true);
  });

  it('opens when the data lands after the push', async () => {
    // The other order, which is the common one on a warm cache.
    const { result, rerender } = await renderHook(
      (props: Parameters<typeof useEditGate>[0]) => useEditGate(props),
      { initialProps: { ...settled, transaction: null, isLoading: true } }
    );

    expect(result.current).toBe(false);

    await act(async () => {
      rerender(settled);
    });

    expect(result.current).toBe(true);
  });

  it('leaves a plain row tap alone', async () => {
    // No `edit` param: tapping the row opens the detail screen and nothing else.
    const { result } = await renderHook(() => useEditGate({ ...settled, edit: undefined }));

    expect(result.current).toBe(false);
  });
});

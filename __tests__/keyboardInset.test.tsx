import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

type Listener = (event: { endCoordinates?: { height?: number } }) => void;

describe('useKeyboardInset', () => {
  const listeners: Record<string, Listener> = {};

  beforeEach(() => {
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      listeners[event] = listener as Listener;
      return { remove: jest.fn() } as never;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
  });

  it('tracks the measured keyboard height and clears it on hide', async () => {
    const { result } = await renderHook(() => useKeyboardInset());
    const show = listeners.keyboardWillShow ?? listeners.keyboardDidShow;
    const hide = listeners.keyboardWillHide ?? listeners.keyboardDidHide;

    await act(async () => show({ endCoordinates: { height: 312 } }));
    expect(result.current).toBe(312);

    await act(async () => hide({}));
    expect(result.current).toBe(0);
  });

  it('does not subscribe when disabled', async () => {
    const { result } = await renderHook(() => useKeyboardInset(false));
    expect(Keyboard.addListener).not.toHaveBeenCalled();
  });
});

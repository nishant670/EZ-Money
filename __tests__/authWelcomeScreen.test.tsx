import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AuthScreen1 } from '@/components/auth/AuthScreen1';

describe('welcome screen', () => {
  it('makes guest the primary action and demotes the account paths', async () => {
    const onGuest = jest.fn();
    const onIdentifier = jest.fn();
    const screen = await render(
      <AuthScreen1 onGuest={onGuest} onIdentifier={onIdentifier} onGoogle={jest.fn()} />
    );

    // The accent button — the one thing on the screen that leads straight to
    // the app — is the guest path.
    await fireEvent.press(screen.getByText("Start tracking — it's free"));
    expect(onGuest).toHaveBeenCalledTimes(1);
    expect(onIdentifier).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Use email or mobile'));
    expect(onIdentifier).toHaveBeenCalledTimes(1);
  });

  it('states the guest terms up front instead of on a screen after the tap', async () => {
    const screen = await render(
      <AuthScreen1 onGuest={jest.fn()} onIdentifier={jest.fn()} onGoogle={jest.fn()} />
    );

    expect(screen.getByText(/Your data stays on this device/)).toBeTruthy();
    expect(screen.getByText('No bank connection required')).toBeTruthy();
  });

  it('locks every action while a check-in is in flight', async () => {
    const onGuest = jest.fn();
    const onIdentifier = jest.fn();
    const screen = await render(
      <AuthScreen1
        onGuest={onGuest}
        onIdentifier={onIdentifier}
        onGoogle={jest.fn()}
        isGuestLoading
      />
    );

    await fireEvent.press(screen.getByText('Use email or mobile'));
    expect(onIdentifier).not.toHaveBeenCalled();
  });
});

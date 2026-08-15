import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AuthSecuritySetupScreen } from '@/components/auth/AuthSecuritySetupScreen';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const enterPin = async (screen: any, digits: string) => {
  for (const digit of digits.split('')) {
    await fireEvent.press(screen.getByText(digit));
  }
};

describe('auth security setup', () => {
  it('skips the PIN and continues when nothing is configured', async () => {
    const onContinue = jest.fn();
    const screen = await render(<AuthSecuritySetupScreen onContinue={onContinue} />);

    // The button names the thing it does. A "Continue" that quietly meant
    // "skip" is what made the old copy a lie.
    await fireEvent.press(screen.getByText('Set up later'));

    expect(onContinue).toHaveBeenCalledWith({ pin: null, biometricsEnabled: false });
  });

  it('says the PIN is optional rather than required', async () => {
    const screen = await render(<AuthSecuritySetupScreen onContinue={jest.fn()} />);

    expect(screen.getByText(/Create a 4-digit code — optional/)).toBeTruthy();
    expect(screen.queryByText(/Set up a PIN, then optionally/)).toBeNull();
  });

  it('carries a configured PIN through and switches the button to the confirm label', async () => {
    const onContinue = jest.fn();
    const screen = await render(
      <AuthSecuritySetupScreen onContinue={onContinue} continueLabel="Sign in" />
    );

    await fireEvent.press(screen.getByLabelText('Set up a PIN'));
    await enterPin(screen, '1379');
    // The keypad steps to confirmation on a timer.
    await screen.findByText('Confirm your PIN');
    await enterPin(screen, '1379');

    expect(screen.getByText('PIN Configured')).toBeTruthy();
    expect(screen.queryByText('Set up later')).toBeNull();

    await fireEvent.press(screen.getByText('Sign in'));
    expect(onContinue).toHaveBeenCalledWith({ pin: '1379', biometricsEnabled: false });
  });

  it('refuses biometrics until there is a PIN to fall back on', async () => {
    const onContinue = jest.fn();
    const screen = await render(<AuthSecuritySetupScreen onContinue={onContinue} />);

    await fireEvent(screen.getByRole('switch'), 'valueChange', true);

    expect(screen.getByText(/Set a PIN first/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Set up later'));
    expect(onContinue).toHaveBeenCalledWith({ pin: null, biometricsEnabled: false });
  });
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AuthSecuritySetupScreen } from '@/components/auth/AuthSecuritySetupScreen';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

describe('auth security setup', () => {
  it('requires an explicit PIN before continuing', async () => {
    const onContinue = jest.fn();
    const screen = await render(<AuthSecuritySetupScreen onContinue={onContinue} />);

    expect(screen.queryByText('Skip for now')).toBeNull();

    fireEvent.press(screen.getByText('Continue'));

    expect(onContinue).not.toHaveBeenCalled();
  });
});

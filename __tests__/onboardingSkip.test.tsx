import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import OnboardingScreen from '@/app/onboarding';

describe('onboarding Skip', () => {
  beforeEach(async () => {
    mockReplace.mockClear();
    jest.restoreAllMocks();
    // The storage mock is shared across tests in this file, and the first test
    // legitimately writes the completion flag. Left behind, it makes the guard
    // redirect the next test before a slide ever renders.
    await AsyncStorage.clear();
  });

  it('leaves onboarding from the very first slide', async () => {
    const screen = await render(<OnboardingScreen />);

    // The guard reads the flag before rendering anything, so wait for the
    // first slide rather than the null it returns until then.
    const skip = await waitFor(() => screen.getByText('Skip'));
    await fireEvent.press(skip);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth'));
  });

  it('still leaves when the completion flag cannot be written', async () => {
    // A failed write used to reject inside the press handler and navigate
    // nowhere — the button looked dead for a reason that had nothing to do
    // with where it was drawn.
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    const screen = await render(<OnboardingScreen />);
    const skip = await waitFor(() => screen.getByText('Skip'));
    await fireEvent.press(skip);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth'));
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

  it('offers Skip beside Next rather than in the header', async () => {
    // Skip spent four builds in the top-left corner and was dead on a handset
    // in every one of them, while the footer's buttons — the same handleFinish
    // reached through "Get started" — always worked. This asserts the
    // placement, since the reason for it is not visible in the markup.
    const screen = await render(<OnboardingScreen />);

    const skip = await waitFor(() => screen.getByText('Skip'));
    const next = screen.getByText('Next');
    const dots = screen.getByTestId('onboarding-progress');

    expect(dots).not.toContainElement(skip);
    expect(next.parent?.parent?.parent).toContainElement(skip);
  });

  it('leaves Get started to do it alone on the last slide', async () => {
    const screen = await render(<OnboardingScreen />);
    await waitFor(() => screen.getByText('Next'));

    // `handleNext` defers the index change to a timeout, so each press needs
    // the queue drained before the next slide's button exists.
    for (let slide = 0; slide < 3; slide += 1) {
      await fireEvent.press(screen.getByText('Next'));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    await waitFor(() => screen.getByText('Get started'));
    expect(screen.queryByText('Skip')).toBeNull();
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

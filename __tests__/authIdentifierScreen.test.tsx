import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AuthScreen2 } from '@/components/auth/AuthScreen2';

describe('identifier screen', () => {
  it('offers Google to the guest, who reaches this screen without passing Welcome', async () => {
    const onGoogle = jest.fn();
    const screen = await render(
      <AuthScreen2
        onContinue={jest.fn()}
        onSecondary={jest.fn()}
        onGoogle={onGoogle}
        secondaryLabel="Keep using guest"
      />
    );

    await fireEvent.press(screen.getByText('Continue with Google'));
    expect(onGoogle).toHaveBeenCalledTimes(1);
  });

  it('draws no Google button when the caller has no Google flow to offer', async () => {
    const screen = await render(
      <AuthScreen2 onContinue={jest.fn()} onSecondary={jest.fn()} />
    );

    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('locks both account paths while either one is in flight', async () => {
    const onGoogle = jest.fn();
    const onSecondary = jest.fn();
    const screen = await render(
      <AuthScreen2
        onContinue={jest.fn()}
        onSecondary={onSecondary}
        onGoogle={onGoogle}
        secondaryLabel="Keep using guest"
        isGoogleLoading
      />
    );

    await fireEvent.press(screen.getByText('Keep using guest'));
    expect(onSecondary).not.toHaveBeenCalled();
  });

  it('still leaves without an account when nothing is in flight', async () => {
    const onSecondary = jest.fn();
    const screen = await render(
      <AuthScreen2
        onContinue={jest.fn()}
        onSecondary={onSecondary}
        onGoogle={jest.fn()}
        secondaryLabel="Keep using guest"
      />
    );

    await fireEvent.press(screen.getByText('Keep using guest'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

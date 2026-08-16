import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { GuestUpgradePrompt } from '@/components/home/GuestUpgradePrompt';

describe('guest upgrade prompt', () => {
  it('names the count so the ask points at something the user just made', async () => {
    const screen = await render(
      <GuestUpgradePrompt entryCount={3} onUpgrade={jest.fn()} onDismiss={jest.fn()} />
    );

    expect(screen.getByText(/these 3 transactions/)).toBeTruthy();
  });

  it('reads as singular for one entry', async () => {
    const screen = await render(
      <GuestUpgradePrompt entryCount={1} onUpgrade={jest.fn()} onDismiss={jest.fn()} />
    );

    expect(screen.getByText(/this transaction/)).toBeTruthy();
  });

  it('offers both the upgrade and a way out', async () => {
    const onUpgrade = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <GuestUpgradePrompt entryCount={7} onUpgrade={onUpgrade} onDismiss={onDismiss} />
    );

    await fireEvent.press(screen.getByText('Save my data'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText('Not now'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

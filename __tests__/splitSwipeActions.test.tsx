import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { SwipeActionRow } from '@/components/split/rows/SwipeActionRow';

describe('split swipe actions', () => {
  it('exposes the supplied row actions and forwards the selected action', async () => {
    const onEdit = jest.fn();
    const onOpenChange = jest.fn();
    const screen = await render(
      <SwipeActionRow
        open
        onOpenChange={onOpenChange}
        actions={[{ label: 'Edit', icon: 'pencil-outline', onPress: onEdit }]}>
        <View testID="row" />
      </SwipeActionRow>
    );

    await fireEvent.press(screen.getByLabelText('Edit'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('does not install a gesture stage when the viewer has no actions', async () => {
    const screen = await render(
      <SwipeActionRow open={false} onOpenChange={jest.fn()} actions={[]}>
        <View testID="row" />
      </SwipeActionRow>
    );

    expect(screen.getByTestId('row')).toBeTruthy();
    expect(screen.queryByLabelText('Close row actions')).toBeNull();
  });

  it('spends an open row tap on closing its actions', async () => {
    const onOpenChange = jest.fn();
    const screen = await render(
      <SwipeActionRow
        open
        onOpenChange={onOpenChange}
        actions={[{ label: 'Archive', icon: 'archive-outline', onPress: jest.fn() }]}>
        <View testID="row" />
      </SwipeActionRow>
    );

    await fireEvent.press(screen.getByLabelText('Close row actions'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

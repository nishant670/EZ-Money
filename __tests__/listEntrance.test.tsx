import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { TransactionItem } from '@/components/home/TransactionItem';
import { Motion } from '@/constants/theme';

const row = {
  icon: 'food',
  title: 'Chai',
  category: 'Food & Drinks',
  amount: 42,
  date: '10:24 AM',
};

type Entrance = { presetName: string; delayV: number; durationV: number } | undefined;

/**
 * The outermost node a row renders. Reanimated's `Animated.View` stands in as a
 * plain `View` under test, so the two layout-animation props land here as
 * ordinary props.
 */
const outerPropsOf = async (element: React.ReactElement) => {
  const screen = await render(element);
  const tree = screen.toJSON();
  if (!tree || Array.isArray(tree)) throw new Error('expected a single root');
  return tree.props as { entering?: Entrance; layout?: { presetName: string } };
};

describe('list entrance', () => {
  it('staggers a row by its place in the list', async () => {
    const props = await outerPropsOf(<TransactionItem {...row} entranceIndex={3} />);

    expect(props.entering?.presetName).toBe('FadeInDown');
    expect(props.entering?.durationV).toBe(Motion.duration.base);
    expect(props.entering?.delayV).toBe(3 * Motion.stagger.list.step);
  });

  it('leaves a row that is not part of a list alone', async () => {
    // Nothing is cascading, so nothing should be waiting its turn.
    const props = await outerPropsOf(<TransactionItem {...row} />);

    expect(props.entering).toBeUndefined();
  });

  it('lets the saved row keep its own announcement', async () => {
    // A row written a moment ago mounts into the feed and qualifies for both
    // entrances. The specific one wins: scaling up from an accent wash *and*
    // sliding in on the list's stagger is the row doing two things at once.
    const props = await outerPropsOf(<TransactionItem {...row} entranceIndex={0} isNew />);

    expect(props.entering).toBeUndefined();
  });

  it('gives every row a reflow, so a filtered list moves rather than jumps', async () => {
    const listed = await outerPropsOf(<TransactionItem {...row} entranceIndex={2} />);
    const lone = await outerPropsOf(<TransactionItem {...row} />);

    expect(listed.layout?.presetName).toBe('LinearTransition');
    expect(lone.layout?.presetName).toBe('LinearTransition');
  });
});

describe('swipe actions', () => {
  const handlers = { onEdit: jest.fn(), onDelete: jest.fn() };

  beforeEach(() => {
    handlers.onEdit.mockClear();
    handlers.onDelete.mockClear();
  });

  it('puts Edit and Delete behind a row that has somewhere to send them', async () => {
    const screen = await render(<TransactionItem {...row} {...handlers} />);

    expect(screen.getByLabelText('Edit')).toBeTruthy();
    expect(screen.getByLabelText('Delete')).toBeTruthy();
  });

  it('leaves the gesture off a row with no Undo behind it', async () => {
    // Home's feed and the account detail lists render the same component with
    // nowhere to put a toast, and a delete with no way back is the thing this
    // replaces rather than something to spread.
    const screen = await render(<TransactionItem {...row} />);

    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('reports the action the thumb landed on', async () => {
    const screen = await render(<TransactionItem {...row} {...handlers} />);

    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
  });

  it('spends an open row\'s next tap on closing it, not on navigating', async () => {
    const onPress = jest.fn();
    const onSwipeOpenChange = jest.fn();
    const screen = await render(
      <TransactionItem
        {...row}
        {...handlers}
        onPress={onPress}
        swipeOpen
        onSwipeOpenChange={onSwipeOpenChange}
      />
    );

    await fireEvent.press(screen.getByText('Chai'));

    // The actions are showing because the user is deciding. Leaving for the
    // detail screen is the wrong answer to "never mind".
    expect(onPress).not.toHaveBeenCalled();
    expect(onSwipeOpenChange).toHaveBeenCalledWith(false);
  });

  it('still opens the transaction when the row is closed', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <TransactionItem {...row} {...handlers} onPress={onPress} onSwipeOpenChange={jest.fn()} />
    );

    await fireEvent.press(screen.getByText('Chai'));

    // The press resolves a tick late now: C9 measures the row's icon and amount
    // before it navigates, and `measureInWindow` answers on a callback.
    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
  });

  it('hands the detail screen the frames it will travel out of', async () => {
    // Measured rather than derived, because where a row sits depends on the
    // scroll offset, the day heading above it and whichever filters are on.
    const onPress = jest.fn();
    const screen = await render(
      <TransactionItem {...row} {...handlers} onPress={onPress} onSwipeOpenChange={jest.fn()} />
    );

    await fireEvent.press(screen.getByText('Chai'));

    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
    const origin = onPress.mock.calls[0][0];
    expect(origin).toEqual({
      icon: { x: 0, y: 0, width: 1, height: 1 },
      amount: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  it('measures nothing when the row is only closing an open swipe', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <TransactionItem
        {...row}
        {...handlers}
        swipeOpen
        onPress={onPress}
        onSwipeOpenChange={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByText('Chai'));

    expect(onPress).not.toHaveBeenCalled();
  });
});

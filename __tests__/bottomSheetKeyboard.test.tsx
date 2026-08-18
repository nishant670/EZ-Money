import React from 'react';
import { Keyboard, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';

type KeyboardHandler = (event: { endCoordinates?: { height: number } }) => void;

const listeners: Record<string, KeyboardHandler> = {};

const paddingBottomOf = (node: { props: { style?: unknown } }) => {
  const style = node.props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return (flat as { paddingBottom?: number } | undefined)?.paddingBottom;
};

const showKeyboard = async (height: number) => {
  const show = listeners.keyboardWillShow ?? listeners.keyboardDidShow;
  await act(async () => {
    show({ endCoordinates: { height } });
  });
};

const hideKeyboard = async () => {
  const hide = listeners.keyboardWillHide ?? listeners.keyboardDidHide;
  await act(async () => {
    hide({});
  });
};

describe('bottom sheet keyboard handling', () => {
  beforeEach(() => {
    for (const key of Object.keys(listeners)) delete listeners[key];
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      handler: KeyboardHandler
    ) => {
      listeners[event] = handler;
      return { remove: jest.fn() };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lifts the sheet clear of the keyboard so the form stays visible', async () => {
    const screen = await render(
      <AnimatedBottomSheet visible avoidKeyboard onClose={jest.fn()}>
        <Text>Add Friend</Text>
      </AnimatedBottomSheet>
    );

    const container = screen.getByTestId('bottom-sheet-container');
    expect(paddingBottomOf(container)).toBe(0);

    await showKeyboard(320);
    expect(paddingBottomOf(screen.getByTestId('bottom-sheet-container'))).toBe(320);

    await hideKeyboard();
    expect(paddingBottomOf(screen.getByTestId('bottom-sheet-container'))).toBe(0);
  });

  it('leaves the sheet alone when it does not host a form', async () => {
    const screen = await render(
      <AnimatedBottomSheet visible onClose={jest.fn()}>
        <Text>Paid by</Text>
      </AnimatedBottomSheet>
    );

    expect(Object.keys(listeners)).toHaveLength(0);
    expect(paddingBottomOf(screen.getByTestId('bottom-sheet-container'))).toBe(0);
  });
});

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { AppHeader } from '@/components/navigation/AppHeader';

/**
 * The header's own padding has to be overridable, and it was not.
 *
 * `px-6 py-4` compiles to `paddingLeft` / `paddingRight` / `paddingTop` /
 * `paddingBottom` — Tailwind emits the longhands — and Yoga reads a longhand as
 * more specific than the `paddingHorizontal` shorthand whatever order they
 * arrive in. So the Split screen, which renders the header inside a scroll view
 * that already pads to 24 and passes `paddingHorizontal: 0` to cancel the
 * header's own, was silently ignored: the title sat at 48 while Money and
 * Profile sat at 24, and the difference was visible on the same handset by
 * switching tabs.
 *
 * Both sides speak the shorthand now, so the last one written wins, which is
 * what an override is for.
 */
const headerStyle = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as ViewStyle);

/** The header row itself — the view the title is a child of. */
const headerOf = (screen: { getByText: (text: string) => any }, title: string) =>
  screen.getByText(title).parent.parent;

describe('AppHeader padding', () => {
  it('pads itself the way every other screen is padded', async () => {
    const screen = await render(<AppHeader title="Money" />);

    expect(headerStyle(headerOf(screen, 'Money'))).toEqual(
      expect.objectContaining({ paddingHorizontal: 24, paddingVertical: 16 })
    );
  });

  it('lets a caller that has already padded turn it off', async () => {
    // Exactly what the Split screen passes.
    const screen = await render(
      <AppHeader
        title="Split"
        style={{ marginBottom: 20, paddingHorizontal: 0, paddingVertical: 0 }}
      />
    );

    expect(headerStyle(headerOf(screen, 'Split'))).toEqual(
      expect.objectContaining({ paddingHorizontal: 0, paddingVertical: 0, marginBottom: 20 })
    );
  });
});

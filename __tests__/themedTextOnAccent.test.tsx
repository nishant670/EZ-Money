import { cleanup, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { getMoodColors, ThemeMoods, type ThemeMoodId } from '@/constants/theme';
import { useAppMoodStore } from '@/hooks/use-app-mood-store';

/**
 * Text on the accent fill must be the on-accent ink in *both* modes.
 *
 * `className="text-white"` could not do this: `ThemedText` passes its colour in
 * the `style` prop, and NativeWind ranks inline styles above class rules, so
 * the class was dropped and the label took the theme's ink instead — near-black
 * on the light theme, near-white on the dark one. On the orange accent that
 * read as a badge whose number changed colour with the time of day.
 */

/** The flattened style a rendered `ThemedText` actually applies. */
function styleOf(element: { props: { style?: unknown } }): TextStyle {
  return (StyleSheet.flatten(element.props.style as never) ?? {}) as TextStyle;
}

/**
 * The colour a `ThemedText` lands on under a given mood.
 *
 * Mounted and unmounted inside the one call so the mood is only ever set while
 * nothing is on screen — switching it under a live tree is a state update
 * outside `act`, which is a warning rather than a fact about the component.
 */
async function colorUnder(
  { nightMode, themeColor = 'finnri' }: { nightMode: boolean; themeColor?: ThemeMoodId },
  props: ThemedTextProps = {}
) {
  useAppMoodStore.setState({ nightMode, themeColor });
  const screen = await render(<ThemedText {...props}>Label</ThemedText>);
  const color = styleOf(screen.getByText('Label')).color;
  await cleanup();
  return color;
}

afterEach(() => {
  useAppMoodStore.setState({ nightMode: false, themeColor: 'finnri' });
});

describe('ThemedText onAccent', () => {
  it('is the on-accent ink in light mode, not the theme text colour', async () => {
    expect(await colorUnder({ nightMode: false }, { onAccent: true })).toBe('#FFFFFF');
  });

  it('is the same ink in dark mode — the accent under it did not invert', async () => {
    expect(await colorUnder({ nightMode: true }, { onAccent: true })).toBe('#FFFFFF');
  });

  it('does not change colour between the two modes', async () => {
    expect(await colorUnder({ nightMode: false }, { onAccent: true })).toBe(
      await colorUnder({ nightMode: true }, { onAccent: true })
    );
  });

  it('holds for every mood, since each one fills with its own accent', async () => {
    for (const themeColor of Object.keys(ThemeMoods) as ThemeMoodId[]) {
      for (const nightMode of [false, true]) {
        expect({
          themeColor,
          nightMode,
          color: await colorUnder({ nightMode, themeColor }, { onAccent: true }),
        }).toEqual({
          themeColor,
          nightMode,
          color: getMoodColors(themeColor)[nightMode ? 'dark' : 'light'].onAccent,
        });
      }
    }
  });

  it('leaves ordinary text on the theme ink, which does follow the mode', async () => {
    expect(await colorUnder({ nightMode: false })).toBe(ThemeMoods.finnri.light.text);
    expect(await colorUnder({ nightMode: true })).toBe(ThemeMoods.finnri.dark.text);
  });

  it('still yields to an explicit colour from the caller', async () => {
    expect(
      await colorUnder({ nightMode: false }, { onAccent: true, style: { color: '#123456' } })
    ).toBe('#123456');
  });
});

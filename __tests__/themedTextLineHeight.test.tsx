import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

import { ThemedText, resolveLineHeight } from '@/components/themed-text';
import { Typography, derivedLineHeight } from '@/constants/theme';

/**
 * X14. `ThemedText`'s presets pair a font size with a line height; a caller's
 * size override does not bring one, because neither `text-[Npx]` nor
 * `style={{ fontSize }}` implies a line height. The preset's height then boxes
 * a glyph it was never measured for and clips it — and the clipped part of
 * `₹40,486` is the comma's tail, so the screen shows a different number.
 */

/** The flattened style a rendered `ThemedText` actually applies. */
function styleOf(element: { props: { style?: unknown } }): TextStyle {
  return (StyleSheet.flatten(element.props.style as never) ?? {}) as TextStyle;
}

describe('derivedLineHeight', () => {
  it('is the ratio the presets are already drawn at', () => {
    // Every preset that pairs the two sits at or above the derived height for
    // its size, which is what makes the rule an extension of the scale rather
    // than a second opinion about it.
    for (const [name, preset] of Object.entries(Typography)) {
      const { fontSize, lineHeight } = preset as TextStyle;
      if (typeof fontSize !== 'number' || typeof lineHeight !== 'number') continue;
      expect({ name, fits: lineHeight >= fontSize * 1.15 }).toEqual({ name, fits: true });
    }
  });

  it('lands within a pixel of the heights that were hand-tuned on a handset', () => {
    // W2's Home hero pinned 40 at 30px, the account detail hero 48 at 38px and
    // the donut total 26 at 19px, each arrived at independently. If the ratio
    // disagreed with all three, it would be the ratio that was wrong.
    expect(derivedLineHeight(30)).toBe(39);
    expect(derivedLineHeight(38)).toBe(49);
    expect(derivedLineHeight(19)).toBe(25);
  });

  it('rounds to a whole pixel', () => {
    expect(derivedLineHeight(11)).toBe(14);
    expect(Number.isInteger(derivedLineHeight(17))).toBe(true);
  });
});

describe('resolveLineHeight', () => {
  const body = Typography.body; // 14 / 21 — the shape of ThemedText's default.

  it('grows the box when the override outsizes the preset', () => {
    expect(resolveLineHeight(body, { fontSize: 30 })).toBe(39);
    expect(resolveLineHeight(body, { fontSize: 18 })).toBe(23);
  });

  it('leaves a smaller override alone', () => {
    // 134 of the app's 148 size overrides are 10px or 11px. They sit in a roomy
    // 21px box, not a clipping one, and re-spacing them would be a layout
    // change dressed up as a bug fix.
    expect(resolveLineHeight(body, { fontSize: 10 })).toBeUndefined();
    expect(resolveLineHeight(body, { fontSize: 11 })).toBeUndefined();
    expect(resolveLineHeight(body, { fontSize: 14 })).toBeUndefined();
  });

  it('never shrinks a box — the rule is max, not replace', () => {
    for (let size = 1; size <= 60; size += 1) {
      const resolved = resolveLineHeight(body, { fontSize: size });
      if (resolved !== undefined) expect(resolved).toBeGreaterThan(body.lineHeight);
    }
  });

  it('defers to an explicit line height, whatever the size', () => {
    expect(resolveLineHeight(body, { fontSize: 30, lineHeight: 40 })).toBeUndefined();
    expect(resolveLineHeight(body, { fontSize: 10, lineHeight: 14 })).toBeUndefined();
    // A caller re-spacing the preset without touching its size must survive too.
    expect(resolveLineHeight(body, { lineHeight: 32 })).toBeUndefined();
  });

  it('says nothing when the caller says nothing', () => {
    expect(resolveLineHeight(body, undefined)).toBeUndefined();
    expect(resolveLineHeight(body, { color: 'red' })).toBeUndefined();
  });

  it('reads the size out of a style array, which is how nativewind delivers it', () => {
    // `className="text-[30px]"` is merged in beside the inline style rather
    // than replacing it, so the size and the colour arrive in different
    // members of the same array.
    expect(resolveLineHeight(body, [{ fontSize: 30 }, { color: 'red' }])).toBe(39);
    expect(resolveLineHeight(body, [{ fontSize: 30 }, { lineHeight: 40 }])).toBeUndefined();
    // Later members win in a flatten, and must win here as well.
    expect(resolveLineHeight(body, [{ fontSize: 30 }, { fontSize: 10 }])).toBeUndefined();
    expect(resolveLineHeight(body, [null, false, { fontSize: 18 }])).toBe(23);
  });

  it('stays quiet for a preset that never fixed a line height', () => {
    // `subtitle` leaves the platform to measure the line against the font in
    // use, which is a better answer than any ratio. Nothing to outgrow.
    expect(resolveLineHeight({ fontSize: 18 }, { fontSize: 40 })).toBeUndefined();
    expect(resolveLineHeight(undefined, { fontSize: 40 })).toBeUndefined();
  });
});

describe('ThemedText', () => {
  it('boxes an oversized override at the derived height', async () => {
    const screen = await render(<ThemedText style={{ fontSize: 30 }}>₹40,486</ThemedText>);
    const style = styleOf(screen.getByText('₹40,486'));

    expect(style.fontSize).toBe(30);
    expect(style.lineHeight).toBe(39);
  });

  it('does the same for a variant, whose height is not the default 21', async () => {
    // `CreditStatusCard` renders an 18px figure in `cardTitle`'s 20px box.
    const screen = await render(
      <ThemedText variant="cardTitle" style={{ fontSize: 18 }}>
        12
      </ThemedText>
    );
    const style = styleOf(screen.getByText('12'));

    expect(style.fontSize).toBe(18);
    expect(style.lineHeight).toBe(23);
  });

  it('keeps the line height the caller supplied', async () => {
    const screen = await render(
      <ThemedText style={{ fontSize: 30, lineHeight: 40 }}>₹40,486</ThemedText>
    );

    expect(styleOf(screen.getByText('₹40,486')).lineHeight).toBe(40);
  });

  it('leaves an unoverridden preset exactly as it was', async () => {
    const plain = await render(<ThemedText>Body</ThemedText>);
    expect(styleOf(plain.getByText('Body'))).toMatchObject({ fontSize: 14, lineHeight: 21 });

    const caption = await render(<ThemedText variant="caption">Caption</ThemedText>);
    expect(styleOf(caption.getByText('Caption'))).toMatchObject({
      fontSize: 12,
      lineHeight: 16,
    });
  });

  it('leaves a smaller override in the preset box', async () => {
    const screen = await render(<ThemedText style={{ fontSize: 10 }}>Micro</ThemedText>);
    const style = styleOf(screen.getByText('Micro'));

    expect(style.fontSize).toBe(10);
    expect(style.lineHeight).toBe(21);
  });

  it('draws every preset in a box its own glyphs fit', async () => {
    // `type="title"` was 28/30 — a ratio of 1.07, the same clipping defect one
    // level up, in the preset table itself.
    for (const type of ['default', 'defaultSemiBold', 'title', 'subtitle', 'link'] as const) {
      const screen = await render(<ThemedText type={type}>{type}</ThemedText>);
      const { fontSize, lineHeight } = styleOf(screen.getByText(type));
      if (typeof lineHeight !== 'number') continue;
      expect({ type, fits: lineHeight >= (fontSize ?? 0) * 1.15 }).toEqual({ type, fits: true });
    }
  });
});

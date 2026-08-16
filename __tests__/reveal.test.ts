import { act, renderHook } from '@testing-library/react-native';

import { REVEAL_MS, useCountUp, useReveal } from '@/hooks/use-reveal';

// `mock`-prefixed so Jest allows the factory below to close over it.
let mockReducedMotion = false;

// `useMotion` is the hook under test's only Reanimated dependency, and it
// reaches the library for the reduced-motion setting and the two layout
// builders. Nothing here animates through Reanimated itself.
jest.mock('react-native-reanimated', () => {
  const passthrough = (presetName: string) => {
    const build = (): Record<string, unknown> => ({
      presetName,
      duration: () => build(),
      delay: () => build(),
      easing: () => build(),
      withInitialValues: () => build(),
    });
    return build();
  };

  return {
    useReducedMotion: () => mockReducedMotion,
    Easing: { bezier: (...curve: number[]) => ({ curve }) },
    withSpring: (toValue: number) => toValue,
    withTiming: (toValue: number) => toValue,
    FadeInDown: passthrough('FadeInDown'),
    LinearTransition: passthrough('LinearTransition'),
  };
});

/**
 * A hand-cranked frame clock.
 *
 * The reveal is the one animation in the app that runs on the JS thread, which
 * is the whole reason it is testable at all — and the reason it is worth
 * testing, since nothing about it is enforced by Reanimated.
 */
let pending: ((timestamp: number) => void) | null = null;
let scheduled = 0;

beforeEach(() => {
  mockReducedMotion = false;
  pending = null;
  scheduled = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    pending = callback;
    scheduled += 1;
    return scheduled;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {
    pending = null;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Runs the frame the hook is waiting on, at `timestamp` ms since the epoch. */
const frame = async (timestamp: number) => {
  const callback = pending;
  pending = null;
  if (!callback) throw new Error('no frame was scheduled');
  await act(async () => {
    callback(timestamp);
  });
};

describe('useReveal', () => {
  it('runs from nothing to whole over the reveal duration', async () => {
    const { result } = await renderHook(() => useReveal('period'));

    expect(result.current).toBe(0);

    // The first callback's timestamp is the start, so a component that mounted
    // a few frames before the clock began does not lose that time off the front
    // of its reveal.
    await frame(1000);
    expect(result.current).toBe(0);

    await frame(1000 + REVEAL_MS / 2);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1);

    await frame(1000 + REVEAL_MS);
    expect(result.current).toBe(1);
  });

  it('stops scheduling frames once it has arrived', async () => {
    await renderHook(() => useReveal('period'));

    await frame(0);
    await frame(REVEAL_MS);

    expect(pending).toBeNull();
  });

  it('moves forwards only', async () => {
    const { result } = await renderHook(() => useReveal('period'));

    await frame(0);
    const readings: number[] = [];
    for (let elapsed = 50; elapsed < REVEAL_MS; elapsed += 50) {
      await frame(elapsed);
      readings.push(result.current);
    }

    readings.forEach((reading, index) => {
      if (index === 0) return;
      expect(reading).toBeGreaterThan(readings[index - 1]);
    });
  });

  it('starts over when the content it describes changes', async () => {
    const { result, rerender } = await renderHook(({ key }: { key: string }) => useReveal(key), {
      initialProps: { key: 'august' },
    });

    await frame(0);
    await frame(REVEAL_MS);
    expect(result.current).toBe(1);

    await act(async () => {
      rerender({ key: 'july' });
    });
    expect(result.current).toBe(0);
  });

  it('holds still through a refresh that returns the same answer', async () => {
    const { result, rerender } = await renderHook(({ key }: { key: string }) => useReveal(key), {
      initialProps: { key: 'august' },
    });

    await frame(0);
    await frame(REVEAL_MS);

    await act(async () => {
      rerender({ key: 'august' });
    });

    expect(result.current).toBe(1);
    expect(pending).toBeNull();
  });
});

describe('useCountUp', () => {
  it('climbs to the amount', async () => {
    const { result } = await renderHook(() => useCountUp(40486));

    expect(result.current).toBe(0);

    await frame(0);
    await frame(REVEAL_MS / 2);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(40486);

    await frame(REVEAL_MS);
    expect(result.current).toBe(40486);
  });

  it('counts a large amount in whole rupees', async () => {
    const { result } = await renderHook(() => useCountUp(40486));

    await frame(0);
    await frame(REVEAL_MS / 2);

    // `formatMoney` sheds paise at or above ₹100, so counting through fractions
    // would flicker two decimal places on and off for half a second.
    expect(Number.isInteger(result.current)).toBe(true);
  });

  it('keeps the paise on a small one', async () => {
    // A ₹42.50 chai is not a ₹43 chai, and it is not six visible steps either.
    const { result } = await renderHook(() => useCountUp(42.5));

    await frame(0);
    const readings = new Set<number>();
    for (let elapsed = 40; elapsed <= REVEAL_MS; elapsed += 40) {
      await frame(elapsed);
      readings.add(result.current);
    }

    expect(readings.size).toBeGreaterThan(6);
    expect(result.current).toBe(42.5);
  });

  it('leaves an empty period at zero without pretending to count', async () => {
    const { result } = await renderHook(() => useCountUp(0));

    await frame(0);
    await frame(REVEAL_MS / 2);
    expect(result.current).toBe(0);

    await frame(REVEAL_MS);
    expect(result.current).toBe(0);
  });
});

describe('with reduced motion on', () => {
  beforeEach(() => {
    mockReducedMotion = true;
  });

  it('is finished before the first render, and never asks for a frame', async () => {
    const { result } = await renderHook(() => useReveal('period'));

    expect(result.current).toBe(1);
    expect(scheduled).toBe(0);
  });

  it('shows the amount rather than counting to it', async () => {
    const { result } = await renderHook(() => useCountUp(40486));

    expect(result.current).toBe(40486);
    expect(scheduled).toBe(0);
  });
});

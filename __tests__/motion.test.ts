import { renderHook } from '@testing-library/react-native';

import { EXIT_RATIO, Motion, cubicBezier, getThemeTokens } from '@/constants/theme';
import { useMotion } from '@/hooks/use-motion';

// `mock`-prefixed so Jest allows the factory below to close over it.
let mockReducedMotion = false;

jest.mock('react-native-reanimated', () => {
  // A chainable stand-in for the layout-animation builders: each modifier
  // records what it was handed and returns the chain, so the assertions below
  // can read the duration, delay and travel the entrance was built from. It
  // lives inside the factory because the factory runs before any `const` in
  // this file has been initialised.
  const layoutBuilder = (presetName: string) => {
    const build = (config: Record<string, unknown>): Record<string, unknown> => ({
      presetName,
      ...config,
      duration: (durationV: number) => build({ ...config, durationV }),
      delay: (delayV: number) => build({ ...config, delayV }),
      easing: (easingV: unknown) => build({ ...config, easingV }),
      withInitialValues: (initialValues: unknown) => build({ ...config, initialValues }),
    });
    return build({});
  };

  return {
    useReducedMotion: () => mockReducedMotion,
    Easing: {
      bezier: (...curve: number[]) => ({ curve }),
    },
    withSpring: (toValue: number, config: unknown) => ({ kind: 'spring', toValue, config }),
    withTiming: (toValue: number, config: unknown) => ({ kind: 'timing', toValue, config }),
    FadeInDown: layoutBuilder('FadeInDown'),
    LinearTransition: layoutBuilder('LinearTransition'),
  };
});

const curveOf = (config: { easing: unknown }) => (config.easing as { curve: number[] }).curve;

beforeEach(() => {
  mockReducedMotion = false;
});

describe('Motion tokens', () => {
  it('holds the values the design vocabulary specifies', () => {
    expect(Motion.duration).toEqual({ instant: 120, base: 220, sheet: 320 });
    expect(Motion.ease.standard).toEqual([0.22, 1, 0.36, 1]);
    expect(Motion.ease.exit).toEqual([0.4, 0, 1, 1]);
    expect(Motion.spring.press).toEqual({ damping: 18, stiffness: 260 });
    expect(Motion.stagger.list).toEqual({ step: 28, max: 8 });
  });

  it('renders a curve as a CSS timing function', () => {
    expect(cubicBezier(Motion.ease.standard)).toBe('cubic-bezier(0.22,1,0.36,1)');
  });

  it('rides along with the rest of the theme tokens', () => {
    expect(getThemeTokens('light').motion).toBe(Motion);
  });
});

describe('useMotion', () => {
  it('resolves durations from the tokens', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(result.current.duration('instant')).toBe(120);
    expect(result.current.duration('base')).toBe(220);
    expect(result.current.duration('sheet')).toBe(320);
  });

  it('makes every exit faster than its matching entry', async () => {
    const { result } = await renderHook(() => useMotion());

    (['instant', 'base', 'sheet'] as const).forEach((token) => {
      expect(result.current.exitDuration(token)).toBeLessThan(result.current.duration(token));
      expect(result.current.exitDuration(token)).toBe(
        Math.round(Motion.duration[token] * EXIT_RATIO)
      );
    });
  });

  it('pairs entries with the standard curve and exits with the exit curve', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(curveOf(result.current.enter('base'))).toEqual([0.22, 1, 0.36, 1]);
    expect(curveOf(result.current.exit('base'))).toEqual([0.4, 0, 1, 1]);
  });

  it('staggers a list one step per row and stops at the cap', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(result.current.stagger(0)).toBe(0);
    expect(result.current.stagger(1)).toBe(28);
    expect(result.current.stagger(7)).toBe(196);
    // The 80th row of a long feed arrives with the 8th, not two seconds later.
    expect(result.current.stagger(8)).toBe(196);
    expect(result.current.stagger(80)).toBe(196);
  });

  it('builds a row entrance from the list stagger and the base duration', async () => {
    const { result } = await renderHook(() => useMotion());

    const entrance = result.current.rowEntering(3) as unknown as {
      presetName: string;
      durationV: number;
      delayV: number;
      easingV: { curve: number[] };
      initialValues: { opacity: number; transform: { translateY: number }[] };
    };

    expect(entrance.presetName).toBe('FadeInDown');
    expect(entrance.durationV).toBe(Motion.duration.base);
    expect(entrance.delayV).toBe(3 * Motion.stagger.list.step);
    expect(entrance.easingV.curve).toEqual([0.22, 1, 0.36, 1]);
    // From nothing, 12px below where it belongs — not FadeInDown's own 25px,
    // which on a 72px row reads as the row falling into place.
    expect(entrance.initialValues).toEqual({ opacity: 0, transform: [{ translateY: 12 }] });
  });

  it('stops the row entrance cascading past the cap', async () => {
    const { result } = await renderHook(() => useMotion());

    const delayOf = (index: number) =>
      (result.current.rowEntering(index) as unknown as { delayV: number }).delayV;

    expect(delayOf(0)).toBe(0);
    expect(delayOf(7)).toBe(196);
    expect(delayOf(40)).toBe(196);
  });

  it('reflows on the same curve and duration as anything else that moves', async () => {
    const { result } = await renderHook(() => useMotion());

    const reflow = result.current.reflow() as unknown as {
      presetName: string;
      durationV: number;
      easingV: { curve: number[] };
    };

    expect(reflow.presetName).toBe('LinearTransition');
    expect(reflow.durationV).toBe(Motion.duration.base);
    expect(reflow.easingV.curve).toEqual([0.22, 1, 0.36, 1]);
  });

  it('gives press feedback the spring token', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(result.current.springTo(1.04)).toEqual({
      kind: 'spring',
      toValue: 1.04,
      config: { damping: 18, stiffness: 260 },
    });
  });
});

describe('springTo is callable from the UI runtime', () => {
  it('carries the worklet directive', async () => {
    // C5's swipe assigns this from a gesture's `onEnd`, which is a worklet.
    // Without the directive the assignment throws "Tried to synchronously call
    // a Remote Function" the first time a finger lets go — which is exactly
    // what it did, on every release, until C8's device pass performed one.
    // `tsc` cannot see it and neither can a render test, so the directive is
    // pinned here instead.
    const { result } = await renderHook(() => useMotion());

    expect((result.current.springTo as unknown as { __workletHash?: number }).__workletHash)
      .toEqual(expect.any(Number));
  });

  it('is still an ordinary function on the JS thread', async () => {
    // The directive must not cost the effect-driven callers anything.
    const { result } = await renderHook(() => useMotion());

    expect(result.current.springTo(1.04)).toEqual({
      kind: 'spring',
      toValue: 1.04,
      config: { damping: 18, stiffness: 260 },
    });
  });
});

describe('useMotion with reduced motion on', () => {
  beforeEach(() => {
    mockReducedMotion = true;
  });

  it('collapses every duration to an instant state change', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(result.current.reduced).toBe(true);
    (['instant', 'base', 'sheet'] as const).forEach((token) => {
      expect(result.current.duration(token)).toBe(0);
      expect(result.current.exitDuration(token)).toBe(0);
      expect(result.current.enter(token).duration).toBe(0);
      expect(result.current.exit(token).duration).toBe(0);
    });
  });

  it('degrades the press spring to a zero-length timing', async () => {
    const { result } = await renderHook(() => useMotion());

    // A spring has no duration to zero, so the degrade has to be a different
    // animation — one that lands on the same value in the same frame.
    const animation = result.current.springTo(1.04) as unknown as {
      kind: string;
      toValue: number;
      config: { duration: number };
    };
    expect(animation.kind).toBe('timing');
    expect(animation.toValue).toBe(1.04);
    expect(animation.config.duration).toBe(0);
  });

  it('drops the list stagger so rows do not cascade', async () => {
    const { result } = await renderHook(() => useMotion());

    expect(result.current.stagger(0)).toBe(0);
    expect(result.current.stagger(5)).toBe(0);
  });

  it('withholds the layout animations entirely rather than zeroing them', async () => {
    const { result } = await renderHook(() => useMotion());

    // A zero-length builder would still hand the row to Reanimated's layout
    // manager on the way in. There is nothing to gain from that when the answer
    // is "do not animate", so the prop is simply absent.
    expect(result.current.rowEntering(0)).toBeUndefined();
    expect(result.current.rowEntering(6)).toBeUndefined();
    expect(result.current.reflow()).toBeUndefined();
  });

  it('leaves the raw tokens alone — only the reader degrades', async () => {
    await renderHook(() => useMotion());

    expect(Motion.duration.base).toBe(220);
  });
});

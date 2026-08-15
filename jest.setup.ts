import * as matchers from '@testing-library/react-native/matchers';

expect.extend(matchers);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@expo/vector-icons', () => {
  return {
    MaterialCommunityIcons: () => null,
  };
});

// Reanimated pulls in react-native-worklets, which reaches for a native module
// the moment it is imported and throws under Jest. The library's own `mock`
// entry re-exports the real index, so it fails the same way.
//
// This stands in for the parts the app actually uses. It is deliberately a
// *working* fake rather than a set of no-ops: shared values are real objects,
// `useAnimatedStyle` runs its worklet and returns the style, and the animation
// builders resolve to their target value immediately. That means a component
// under test renders in its settled state, which is the state assertions are
// written against — and a typo in a style worklet still throws.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');

  /** Animations land on their target value in the same tick. */
  const settle = (toValue: unknown) => toValue;

  const interpolate = (
    value: number,
    inputRange: number[],
    outputRange: number[],
    extrapolate?: string
  ) => {
    const last = inputRange.length - 1;
    if (value <= inputRange[0]) {
      return extrapolate === 'clamp' ? outputRange[0] : outputRange[0];
    }
    if (value >= inputRange[last]) return outputRange[last];
    for (let i = 1; i <= last; i += 1) {
      if (value <= inputRange[i]) {
        const span = inputRange[i] - inputRange[i - 1];
        const ratio = span === 0 ? 0 : (value - inputRange[i - 1]) / span;
        return outputRange[i - 1] + ratio * (outputRange[i] - outputRange[i - 1]);
      }
    }
    return outputRange[last];
  };

  // The RN components stand in directly rather than through a wrapper. Building
  // one here would mean `React.createElement` inside a `jest.mock` factory,
  // which nativewind's babel transform rewrites into a reference the factory is
  // not allowed to reach. They already take style arrays and refs, and nothing
  // passes Reanimated-only props that would need stripping.
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    ScrollView: RN.ScrollView,
    Image: RN.Image,
    createAnimatedComponent: (Component: unknown) => Component,
  };

  /** A chainable stand-in for `FadeInDown`, `LinearTransition` and friends. */
  const makeLayoutBuilder = (presetName: string) => {
    const build = (config: Record<string, unknown>) => ({
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
    __esModule: true,
    default: Animated,
    ...Animated,
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useAnimatedStyle: (worklet: () => unknown) => worklet(),
    useAnimatedRef: () => React.useRef(null),
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedReaction: () => undefined,
    useDerivedValue: (worklet: () => unknown) => ({ value: worklet() }),
    cancelAnimation: () => undefined,
    runOnJS: (fn: unknown) => fn,
    // Gesture Handler builds its detectors on these two rather than on the
    // public hooks. They are here so `GestureDetector` renders for real under
    // test — the pan itself cannot be performed, but a component that fails to
    // mount inside one still fails.
    useEvent: () => jest.fn(),
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    useComposedEventHandler: () => jest.fn(),
    setGestureState: () => undefined,
    interpolate,
    withTiming: settle,
    withSpring: settle,
    withDelay: (_delay: number, animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    withRepeat: (animation: unknown) => animation,
    // Layout animations are builders rather than animations: components pass
    // them to `entering`/`layout` and Reanimated's own layout manager runs
    // them, which is native and not present here. The chain has to keep
    // returning itself so `useMotion` can build one, and the modifiers record
    // what they were given so a test can assert the entrance is staggered.
    FadeInDown: makeLayoutBuilder('FadeInDown'),
    LinearTransition: makeLayoutBuilder('LinearTransition'),
    Easing: {
      bezier: (...curve: number[]) => ({ curve }),
      linear: (t: number) => t,
    },
  };
});

// Haptics are a real assertion target now — "did the app answer on the hand"
// is part of what C2 and C3 promise — so these are spies rather than no-ops.
//
// `performAndroidHapticsAsync` is the one C8 routes Android through, and it
// *resolves* here by default. The real one rejects for a constant the running
// API level does not have, which is the whole reason `lib/haptics.ts` carries
// fallback chains — a test that wants that path makes this spy reject.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  // Mirrors the real enum's string values, so a wrong constant name in
  // `lib/haptics.ts` shows up as a wrong string rather than as `undefined`.
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Gesture_Start: 'gesture-start',
    Gesture_End: 'gesture-end',
    Toggle_On: 'toggle-on',
    Toggle_Off: 'toggle-off',
    Clock_Tick: 'clock-tick',
    Context_Click: 'context-click',
    Drag_Start: 'drag-start',
    Keyboard_Tap: 'keyboard-tap',
    Keyboard_Press: 'keyboard-press',
    Keyboard_Release: 'keyboard-release',
    Long_Press: 'long-press',
    Virtual_Key: 'virtual-key',
    No_Haptics: 'no-haptics',
    Segment_Tick: 'segment-tick',
    Segment_Frequent_Tick: 'segment-frequent-tick',
    Text_Handle_Move: 'text-handle-move',
    Virtual_Key_Release: 'virtual-key-release',
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: () => null,
    DateTimePickerAndroid: {
      open: jest.fn(),
    },
  };
});

/**
 * React Native's `View` mock hands every instance a `measureInWindow` that
 * accepts a callback and never calls it.
 *
 * That is fine for a component that only decorates itself with a measurement,
 * and fatal for one that *waits* on it: C9's row press measures its icon and
 * amount before navigating, so a callback that never fires is a row that never
 * opens — and the symptom in a test is a five-second timeout rather than an
 * assertion, which says nothing about what broke.
 *
 * This is a default, not a fixture. It answers with a frame at the origin so
 * anything measuring gets *an* answer; the tests that care what the answer is
 * (C6's tab marker, C9's travel arithmetic) spy over it with their own table.
 */
beforeEach(() => {
  const { View } = require('react-native');
  // Installed unconditionally. React Native's own mock already makes this a
  // `jest.fn()` — one that accepts the callback and drops it — so checking
  // whether it *is* a mock says yes and skips the fix. The test files that need
  // real frames spy again in their own `beforeEach`, which runs after this one.
  jest
    .spyOn(View.prototype, 'measureInWindow')
    .mockImplementation((...args: unknown[]) => {
      const callback = args[0] as (x: number, y: number, w: number, h: number) => void;
      callback(0, 0, 1, 1);
    });
});

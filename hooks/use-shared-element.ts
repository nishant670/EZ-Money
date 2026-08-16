import { useCallback, useEffect, useRef } from 'react';
import type { View, ViewStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';

/**
 * A hand-rolled shared element: one thing on two screens, drawn twice and made
 * to look like it travelled.
 *
 * ## Why this is hand-rolled
 *
 * Reanimated ships `sharedTransitionTag`, and it is gated behind
 * `ENABLE_SHARED_ELEMENT_TRANSITIONS` — a **static** feature flag compiled into
 * the native library from the app's own `package.json`. Turning it on needs a
 * new dev client and a new release build, Metro cannot flip it, and it is
 * experimental enough that Gradle refuses to build it alongside
 * `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`. This needs none of that, which is
 * also what makes it verifiable on the handset that is already attached.
 *
 * ## How it works, and the one thing it costs
 *
 * The source screen measures the element in *window* coordinates before it
 * navigates and hands the frame over as a route param. The destination measures
 * where its own copy has landed, and the difference between the two frames is a
 * translate and a scale — so the copy is drawn on top of where the original was
 * and released towards where it belongs.
 *
 * That only reads as one object if the two screens are not also sliding past
 * each other, which is why `/entry/[id]` enters on a fade rather than the push
 * every other screen uses. It is the one screen in the app that does, and the
 * transition is the reason.
 *
 * ## Frames cross the boundary as strings
 *
 * Route params are strings, so a frame is packed into four comma-separated
 * numbers rather than JSON — it is read on every row press, and a malformed one
 * has to degrade to "no transition" rather than throw on a screen the user is
 * already looking at.
 */

export type Frame = { x: number; y: number; width: number; height: number };

/** Four numbers, in the order a frame is read. */
export function encodeFrame(frame: Frame): string {
  return [frame.x, frame.y, frame.width, frame.height].map((n) => Math.round(n)).join(',');
}

/**
 * The inverse, and deliberately total: anything that is not four finite numbers
 * comes back as `null`, which every consumer already treats as "arrived without
 * a source, so do not animate".
 */
export function decodeFrame(value: string | undefined | null): Frame | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/** Measures a mounted view in window coordinates. Resolves `null` if it cannot. */
export function measureFrame(ref: React.RefObject<View | null>): Promise<Frame | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Which dimension decides the scale.
 *
 * `width` for a box — an icon tile is the same shape in both places, so either
 * axis gives the same answer. `height` for **text**, and that is not
 * interchangeable: the row says `-₹150` and the detail screen says `₹150`, so
 * the two strings have different widths and a width ratio would scale the
 * amount by the width of a minus sign. Height is the font size, which is the
 * thing actually changing.
 */
export type ScaleBasis = 'width' | 'height';

const IDENTITY: Frame = { x: 0, y: 0, width: 1, height: 1 };

export type SharedElementTarget = {
  /** Put on the view that is arriving. It measures itself from here. */
  onLayout: () => void;
  /** Reanimated style for that same view. */
  style: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
  /** Send it back to where it came from, then call `then`. */
  reverse: (then: () => void) => void;
  /** Whether a transition is actually going to happen. */
  active: boolean;
};

/**
 * The destination half. Give it the frame the element came from and it draws
 * the arriving copy on top of it, then lets it settle into place.
 */
export function useSharedElementTarget(
  ref: React.RefObject<View | null>,
  source: Frame | null,
  scaleBy: ScaleBasis = 'width',
  /**
   * Whether the destination has stopped moving.
   *
   * `measureInWindow` asks the native view where it is *now*, and during a
   * screen transition "now" is not where it will end up — measured while the
   * screen is still arriving, the same hero answered 133dp on one run and 87dp
   * on the next, against a settled 197dp. The element then flies towards a
   * point that was never real, bows above its own destination, and snaps onto
   * it at the end. It always *lands* correctly, because progress 1 is the
   * identity transform, which is exactly why this survives a screenshot and
   * only shows up in motion on a handset.
   *
   * So the target is measured once the screen reports `transitionEnd`. The cost
   * is honest and worth naming: the travel begins as the fade finishes rather
   * than underneath it, so the icon arrives just after the screen does instead
   * of with it. The alternative is a hardcoded hero position, which is the
   * assumption C6 refused to make about the tab bar for the same reason — it
   * would be right on this device and wrong on the next.
   */
  ready = true
): SharedElementTarget {
  const motion = useMotion();
  // A transition needs somewhere to come from, and reduced motion is the case
  // where the honest answer is the plain push rather than a shortened travel.
  const active = Boolean(source) && !motion.reduced;

  // Settled unless there is something to play, so a screen opened any other way
  // never animates.
  const progress = useSharedValue(active ? 0 : 1);
  /**
   * Whether the destination is known yet.
   *
   * Until the measurement lands there is no `to` to travel towards, and the
   * placeholder one is a 1×1 box at the origin — which makes the scale factor
   * the source's width in *pixels* and the translation most of a screen. The
   * element is drawn about fifty times life size, somewhere off the top-left
   * corner. It self-corrects the moment the frame arrives, so the bug is a
   * flash rather than a wrong end state, which is precisely why it survives a
   * still screenshot and only shows up on a handset.
   *
   * The element is simply not drawn until there is somewhere to draw it. Its
   * source is still on screen underneath — the outgoing row, mid-fade — so
   * there is nothing to see missing.
   */
  const armed = useSharedValue(active ? 0 : 1);
  const from = useSharedValue<Frame>(source ?? IDENTITY);
  const to = useSharedValue<Frame>(IDENTITY);
  const measured = useRef(false);

  const start = useCallback(() => {
    // Once. A re-layout mid-flight would re-target a moving element.
    if (!active || !ready || measured.current) return;
    measured.current = true;
    // `onLayout` fires when React Native has *computed* the layout, and
    // `measureInWindow` asks the native view where it actually is. During a
    // screen transition those are not the same frame: measuring immediately
    // answers with where the hero was before the entering screen was positioned
    // — about a header's worth too high — and the element then flies a curve
    // that bows above its own destination before snapping back onto it. The
    // landing is always right, because progress 1 is the identity transform,
    // which is exactly what makes this invisible in a still and obvious in
    // motion. One frame later the native tree agrees with the layout tree.
    requestAnimationFrame(() => {
      void measureFrame(ref).then((frame) => {
        if (!frame) {
          // Nothing to travel to. Land settled rather than stranded.
          armed.value = 1;
          progress.value = 1;
          return;
        }
        to.value = frame;
        armed.value = 1;
        progress.value = withTiming(1, motion.enter('sheet'));
      });
    });
  }, [active, armed, motion, progress, ready, ref, to]);

  // Layout and readiness arrive in either order — a cached screen is laid out
  // long before the transition ends, a slow one the other way round — so both
  // call the same guarded starter and whichever is second wins.
  const laidOut = useRef(false);
  const onLayout = useCallback(() => {
    laidOut.current = true;
    start();
  }, [start]);

  useEffect(() => {
    if (laidOut.current) start();
  }, [start]);

  const style = useAnimatedStyle<ViewStyle>(
    () => heroStyle(from.value, to.value, progress.value, armed.value, scaleBy),
    [scaleBy]
  );

  const reverse = useCallback(
    (then: () => void) => {
      // Never mid-flight: a reverse that starts before the arrival finished
      // would hand the pop a half-played travel, which is the thing this task
      // is not allowed to leave on screen.
      if (!active || progress.value !== 1) {
        then();
        return;
      }
      progress.value = withTiming(0, motion.exit('sheet'), (finished) => {
        'worklet';
        if (finished) runOnJS(then)();
      });
    },
    [active, motion, progress]
  );

  return { onLayout, style, reverse, active };
}

/**
 * Where the arriving copy should be drawn at `progress`.
 *
 * A worklet, and separate from the hook so the arithmetic can be tested on its
 * own — every one of these numbers is a position on a screen, and the only
 * thing worse than an animation that does not run is one that lands the element
 * somewhere plausible but wrong.
 */
export function travel(from: Frame, to: Frame, progress: number, scaleBy: ScaleBasis) {
  'worklet';
  const scale = scaleBy === 'height' ? from.height / to.height : from.width / to.width;
  // Centres, because that is what stays put under a scale.
  const dx = from.x + from.width / 2 - (to.x + to.width / 2);
  const dy = from.y + from.height / 2 - (to.y + to.height / 2);
  const remaining = 1 - progress;

  return {
    transform: [
      { translateX: dx * remaining },
      { translateY: dy * remaining },
      { scale: 1 + (scale - 1) * remaining },
    ],
  };
}

/**
 * What the arriving copy wears at a given progress — the three states the
 * element passes through, as one pure function.
 *
 * Separate from the hook for the same reason `travel` is: the interesting part
 * is which branch runs and what each one *names*, and that can be asserted
 * without a renderer.
 *
 * **`opacity` is named in every branch, and that is not tidiness.** A
 * Reanimated animated style does not reset a property it stops mentioning — the
 * last value applied stays on the native view. The settled branch used to
 * return `{}`, so the `opacity: 0` written while the element was unarmed was
 * never taken back, and the hero icon and the amount were invisible on the
 * detail screen forever: an empty band above the title on every row tap. It
 * measured, armed and animated correctly throughout, which is why it read as a
 * layout bug, and why a suite that only exercised `travel` could not see it.
 *
 * The settled branch still carries no *transform* — the hero is a shadowed,
 * rounded tile, and an Android view with a transform on it is composited
 * differently from one without.
 */
export function heroStyle(
  from: Frame,
  to: Frame,
  progress: number,
  armed: number,
  scaleBy: ScaleBasis
): ViewStyle {
  'worklet';
  if (progress === 1) return { opacity: 1 };
  if (armed === 0) return { opacity: 0 };
  return { opacity: 1, ...travel(from, to, progress, scaleBy) };
}

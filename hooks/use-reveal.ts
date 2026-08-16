import { useEffect, useRef, useState } from 'react';
import { Easing } from 'react-native';

import { Motion } from '@/constants/theme';
import { PAISE_THRESHOLD } from '@/lib/money';
import { useMotion } from '@/hooks/use-motion';

/**
 * A 0 → 1 progress for content that draws itself in when it arrives.
 *
 * Insights lands as a finished page: four figures, a full ring and a month of
 * bars, all at once and all already true. Nothing on the screen says which
 * numbers are this period's answer rather than the last one's, and a period
 * switch changes every one of them in a single frame. This is the clock that
 * lets them arrive instead.
 *
 * ## Why this one runs on the JS thread
 *
 * Every other animation in the app is on the UI thread, and for the same
 * reason: a re-render per frame is how a list drops frames under a finger. This
 * one is different in the only way that matters — its output is *text*, and
 * there is no way to change text from a worklet short of driving a disabled
 * `TextInput` through `animatedProps` and formatting money inside a worklet.
 * That would put `lib/money.ts`, `Intl.NumberFormat` and the whole currency
 * vocabulary across the worklet boundary, which is exactly where C2 and C3 each
 * lost a day to a crash that only a device could produce.
 *
 * So the cost is paid deliberately and kept small: the components that read
 * this are leaves — one figure, one ring, one row of bars — and they re-render
 * nothing above themselves. It runs once when a screen's data lands, on a
 * screen with no gesture in flight, and it is finished in half a second.
 *
 * Under reduced motion it returns 1 from the first render and never schedules a
 * frame: the content is simply there, which is what it was always claiming.
 */

/**
 * How long the reveal takes. Not a `Motion` duration, and not for want of a
 * close one: those describe how quickly the app answers a touch, and this is a
 * number being read *while* it moves. `sheet` at 320ms is a legibility problem
 * for a five-digit total, and a token that means "long enough to read" would be
 * borrowed as a response time within a week.
 */
export const REVEAL_MS = 500;

// The same curve everything else enters on, in the shape a plain JS loop wants.
// `constants/theme.ts` holds the control points precisely so each of the three
// animation systems can build its own; this is React Native's `Easing`, which
// returns the `(t) => number` that a `requestAnimationFrame` loop can call.
const curve = Easing.bezier(...Motion.ease.standard);

/**
 * Progress from 0 to 1 over {@link REVEAL_MS}, restarting whenever `key`
 * changes.
 *
 * `key` is what makes a period switch a new reveal rather than a jump: pass
 * something that changes when the content does — the period's dates, the total
 * being counted — and hold it steady across a refresh that returns the same
 * answer, so a pull-to-refresh does not replay the whole page.
 */
export function useReveal(key: unknown = null): number {
  const motion = useMotion();
  const [progress, setProgress] = useState(motion.reduced ? 1 : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (motion.reduced) {
      setProgress(1);
      return undefined;
    }

    let start: number | null = null;
    const step = (now: number) => {
      // The first callback's timestamp is the start, rather than a `Date.now()`
      // taken when the effect ran: the gap between the two is the frame the
      // component mounted on, and counting it makes a short reveal start late.
      start ??= now;
      const elapsed = now - start;
      if (elapsed >= REVEAL_MS) {
        frame.current = null;
        setProgress(1);
        return;
      }
      setProgress(curve(elapsed / REVEAL_MS));
      frame.current = requestAnimationFrame(step);
    };

    setProgress(0);
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [key, motion.reduced]);

  return progress;
}

/**
 * An amount on its way up from zero.
 *
 * Rounding follows what `formatMoney` will do with the *final* figure rather
 * than with each frame's, which is why it reads `PAISE_THRESHOLD` instead of
 * guessing: paise appear below ₹100, so counting to ₹40,486 through fractions
 * would flicker two decimals on and off for half a second, and counting to
 * ₹42.50 in whole rupees would climb in six visible steps.
 */
export function useCountUp(amount: number): number {
  const progress = useReveal(amount);
  const value = amount * progress;
  return Math.abs(amount) >= PAISE_THRESHOLD ? Math.round(value) : Math.round(value * 100) / 100;
}

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * What the app says with the hand, in the words it means rather than the buzz
 * it produces.
 *
 * Before this there were five hand-spelled calls in four files and no agreement
 * between them: `Haptics.impactAsync(Medium)` twice on Home, `selectionAsync`
 * and another `Medium` in the keypad, `notificationAsync` twice in the entry
 * sheet, each with its own `.catch()`. Every one of them names a *waveform*,
 * which is the wrong unit — "a chip was selected" is a thing the app can decide
 * once, and "a light tap" is a thing the platform should decide from it.
 *
 * ## The system haptic setting is honoured by picking the right API, not by
 * ## reading a preference
 *
 * There is no public way to ask either OS whether haptics are switched on, and
 * `expo-haptics` exposes none. It does not need one:
 *
 * - **Android.** `impactAsync`, `notificationAsync` and `selectionAsync` all
 *   go through `Vibrator.vibrate()` in the native module — a raw motor call
 *   that needs the `VIBRATE` permission and **ignores
 *   `Settings.System.HAPTIC_FEEDBACK_ENABLED` completely**. Everything the app
 *   shipped before this buzzed users who had turned haptics off.
 *   `performAndroidHapticsAsync` instead calls `View.performHapticFeedback`,
 *   which is the system path: it consults that setting itself, and it needs no
 *   permission. Choosing it *is* the fix.
 * - **iOS.** `UIFeedbackGenerator` already consults Settings → Sounds & Haptics
 *   → System Haptics and silently does nothing when it is off, so the existing
 *   calls are correct there and stay.
 *
 * ## Reduced motion is deliberately not wired to this
 *
 * "Reduce Motion" on both platforms is a setting about animation, and haptics
 * are not animation — they are the confirmation that remains when the animation
 * is gone. Silencing them for someone who asked for less movement takes the
 * non-visual signal away from exactly the person most likely to be relying on
 * it. The setting that governs haptics is the haptics setting, and it is
 * honoured above.
 *
 * ## A module rather than a hook
 *
 * `useMotion` is a hook because its answers depend on a setting read through
 * React. Nothing here does — and two call sites need it from places a hook
 * cannot reach: `runOnJS` from inside a gesture worklet, and a plain event
 * handler in a file with no component around it.
 */

/**
 * Android's own haptic constants, in this app's order of preference.
 *
 * The first entry is the one that means what the intent means; the rest are
 * fallbacks. This is not defensive padding — `HapticFeedbackConstants.CONFIRM`
 * and `REJECT` arrived in API 30 and `TOGGLE_ON`, `TOGGLE_OFF` and
 * `SEGMENT_TICK` in API 34, and expo-haptics looks them up by reflection and
 * **throws** when the field is absent. A single semantic constant would mean
 * that on an Android 13 handset — the audit's own OnePlus — saving a
 * transaction produced a rejected promise and no feedback at all, which is
 * indistinguishable from the bug this task exists to fix.
 *
 * Every chain ends on one of the five constants that have existed since API 21.
 */
type AndroidChain = readonly Haptics.AndroidHaptics[];

type Intent = {
  /** UIKit's generator for this meaning. */
  ios: () => Promise<void>;
  android: AndroidChain;
};

const ALWAYS_TAP = Haptics.AndroidHaptics.Virtual_Key;
const ALWAYS_PRESS = Haptics.AndroidHaptics.Long_Press;
const ALWAYS_TICK = Haptics.AndroidHaptics.Clock_Tick;

const intents = {
  /** A chip, a segment, a period, a row that has snapped open. */
  select: {
    ios: () => Haptics.selectionAsync(),
    android: [Haptics.AndroidHaptics.Segment_Tick, ALWAYS_TICK],
  },
  /** A switch moving on. */
  toggleOn: {
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    android: [Haptics.AndroidHaptics.Toggle_On, ALWAYS_TAP],
  },
  /** A switch moving off. */
  toggleOff: {
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    android: [Haptics.AndroidHaptics.Toggle_Off, ALWAYS_TAP],
  },
  /** The mic has opened. */
  captureStart: {
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    android: [Haptics.AndroidHaptics.Gesture_Start, ALWAYS_PRESS],
  },
  /** The mic has closed and the app is about to think. */
  captureStop: {
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    android: [Haptics.AndroidHaptics.Gesture_End, ALWAYS_PRESS],
  },
  /** Written. A transaction, a budget, a subscription, an account, a profile. */
  saved: {
    ios: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    android: [Haptics.AndroidHaptics.Confirm, ALWAYS_TAP],
  },
  /** Refused — a missing field, a bad amount, a server 422. */
  rejected: {
    ios: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    android: [Haptics.AndroidHaptics.Reject, ALWAYS_PRESS],
  },
  /**
   * A row leaving under the thumb.
   *
   * Not `rejected` — Android's `Reject` means the app turned the interaction
   * down, and a delete the user asked for is the opposite of that — and not
   * `saved`, because the Undo window is still open and nothing has been written
   * yet. It is its own weight on purpose.
   */
  removed: {
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    android: [ALWAYS_PRESS, ALWAYS_TAP],
  },
} as const satisfies Record<string, Intent>;

export type HapticIntent = keyof typeof intents;

/**
 * Walks the Android chain until one constant is accepted by the platform.
 *
 * A rejection here is `HapticsNotSupportedException` for a constant this API
 * level does not have, so the next one is tried; when the chain runs out the
 * failure is swallowed. Nothing about a haptic is worth an unhandled rejection
 * — this is the one place that decision is made, instead of at each of the
 * thirty call sites.
 */
const performAndroid = async (chain: AndroidChain): Promise<void> => {
  for (const type of chain) {
    try {
      await Haptics.performAndroidHapticsAsync(type);
      return;
    } catch {
      // Not available at this API level. Try the next one down the chain.
    }
  }
};

const fire = (intent: HapticIntent): void => {
  const { ios, android } = intents[intent];
  const run = Platform.OS === 'android' ? performAndroid(android) : ios();
  // Fire and forget by design: a haptic is feedback about something that has
  // already happened, so nothing may wait on it and nothing may fail because
  // of it.
  void run.catch(() => undefined);
};

/**
 * The vocabulary, as one object so a call site reads `haptics.saved()`.
 *
 * Stable references — they are handed to `runOnJS` from a gesture worklet,
 * which captures what it is given at creation.
 */
export const haptics = {
  select: () => fire('select'),
  toggle: (on: boolean) => fire(on ? 'toggleOn' : 'toggleOff'),
  captureStart: () => fire('captureStart'),
  captureStop: () => fire('captureStop'),
  saved: () => fire('saved'),
  rejected: () => fire('rejected'),
  removed: () => fire('removed'),
} as const;

/** Exposed for the tests that pin the fallback chains to the API levels above. */
export const androidChainFor = (intent: HapticIntent): AndroidChain => intents[intent].android;

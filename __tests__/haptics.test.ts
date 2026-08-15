import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { androidChainFor, haptics, type HapticIntent } from '@/lib/haptics';

const performAndroid = Haptics.performAndroidHapticsAsync as jest.Mock;
const impact = Haptics.impactAsync as jest.Mock;
const notification = Haptics.notificationAsync as jest.Mock;
const selection = Haptics.selectionAsync as jest.Mock;

/**
 * `Platform.OS` is a plain property on the mocked module, so each block sets it
 * and puts it back. The two branches are genuinely different code paths — one
 * calls UIKit generators, the other walks a fallback chain — and testing only
 * the default would leave whichever platform Jest happens to report untested.
 */
const withPlatform = async (os: 'ios' | 'android', run: () => void | Promise<void>) => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  try {
    // Awaited, not returned. A `finally` around a *returned* promise runs the
    // moment the promise is created, so the platform would be put back before
    // anything past the first `await` in `run` had read it — and because
    // `fire()` reads `Platform.OS` synchronously, the tests that only call
    // before their first `await` would still pass. That is the shape of bug
    // this comment exists to stop someone reintroducing.
    await run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  }
};

/** The vocabulary is fire-and-forget, so the promise it swallowed has to drain. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  performAndroid.mockReset().mockResolvedValue(undefined);
  impact.mockReset().mockResolvedValue(undefined);
  notification.mockReset().mockResolvedValue(undefined);
  selection.mockReset().mockResolvedValue(undefined);
});

describe('the Android path is the system one', () => {
  it('never reaches for the raw Vibrator', async () => {
    // This is the whole finding. `impactAsync`, `notificationAsync` and
    // `selectionAsync` call `Vibrator.vibrate()` in expo-haptics' native
    // module, which needs the VIBRATE permission and ignores
    // `Settings.System.HAPTIC_FEEDBACK_ENABLED` outright — so every haptic the
    // app shipped before C8 buzzed users who had turned haptics off.
    await withPlatform('android', async () => {
      haptics.select();
      haptics.toggle(true);
      haptics.captureStart();
      haptics.captureStop();
      haptics.saved();
      haptics.rejected();
      haptics.removed();
      await settle();
    });

    expect(performAndroid).toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
  });

  it('tells a switch going on from one going off', async () => {
    // Android has separate constants for the two directions, and a switch that
    // feels the same both ways is one you have to look at to know what you did.
    await withPlatform('android', async () => {
      haptics.toggle(true);
      await settle();
      haptics.toggle(false);
      await settle();
    });

    expect(performAndroid.mock.calls[0][0]).toBe(Haptics.AndroidHaptics.Toggle_On);
    expect(performAndroid.mock.calls[1][0]).toBe(Haptics.AndroidHaptics.Toggle_Off);
  });

  it('falls down the chain when the API level lacks the constant', async () => {
    // `TOGGLE_ON` is API 34 and `CONFIRM` is API 30, and expo-haptics looks
    // them up by reflection and throws when the field is absent. Without a
    // fallback, saving on an Android 13 handset — the audit's own OnePlus —
    // produces a rejected promise and no feedback at all.
    performAndroid.mockRejectedValueOnce(new Error('HapticsNotSupportedException'));

    await withPlatform('android', async () => {
      haptics.saved();
      await settle();
    });

    expect(performAndroid).toHaveBeenCalledTimes(2);
    expect(performAndroid.mock.calls[0][0]).toBe(Haptics.AndroidHaptics.Confirm);
    expect(performAndroid.mock.calls[1][0]).toBe(Haptics.AndroidHaptics.Virtual_Key);
  });

  it('gives up quietly when the whole chain is refused', async () => {
    // Nothing about a haptic is worth an unhandled rejection.
    performAndroid.mockRejectedValue(new Error('HapticsNotSupportedException'));

    await withPlatform('android', async () => {
      expect(() => haptics.rejected()).not.toThrow();
      await settle();
    });

    expect(performAndroid).toHaveBeenCalledTimes(androidChainFor('rejected').length);
  });

  it('ends every chain on a constant that has always existed', () => {
    // The five below are API 21 or older. Anything else at the end of a chain
    // is a silent no-op waiting for an old handset.
    const alwaysAvailable = [
      Haptics.AndroidHaptics.Clock_Tick,
      Haptics.AndroidHaptics.Context_Click,
      Haptics.AndroidHaptics.Keyboard_Tap,
      Haptics.AndroidHaptics.Long_Press,
      Haptics.AndroidHaptics.Virtual_Key,
    ];
    const intents: HapticIntent[] = [
      'select',
      'toggleOn',
      'toggleOff',
      'captureStart',
      'captureStop',
      'saved',
      'rejected',
      'removed',
    ];

    intents.forEach((intent) => {
      const chain = androidChainFor(intent);
      expect(chain.length).toBeGreaterThan(0);
      expect(alwaysAvailable).toContain(chain[chain.length - 1]);
    });
  });
});

describe('the iOS path stays on the generators', () => {
  it('maps each intent to the generator that means it', async () => {
    await withPlatform('ios', async () => {
      haptics.select();
      haptics.saved();
      haptics.rejected();
      haptics.captureStart();
      haptics.toggle(true);
      await settle();
    });

    expect(selection).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(notification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(performAndroid).not.toHaveBeenCalled();
  });

  it('swallows a generator that rejects', async () => {
    impact.mockRejectedValue(new Error('no haptics engine'));

    await withPlatform('ios', async () => {
      expect(() => haptics.captureStop()).not.toThrow();
      await settle();
    });
  });
});

describe('the vocabulary itself', () => {
  it('hands out stable function references', () => {
    // `runOnJS(haptics.select)` in TransactionItem's gesture captures what it is
    // given at creation, so these cannot be rebuilt per render.
    expect(haptics.select).toBe(haptics.select);
    expect(haptics.saved).toBe(haptics.saved);
  });

  it('returns nothing, so no call site can be tempted to await one', () => {
    // A haptic is feedback about something that has already happened. Awaiting
    // it puts a motor call on the path of the thing it is describing.
    expect(haptics.select()).toBeUndefined();
    expect(haptics.saved()).toBeUndefined();
  });

  it('keeps a delete distinct from a rejection', () => {
    // Android's `Reject` means the app turned the interaction down, and a
    // delete the user asked for is the opposite of that.
    expect(androidChainFor('removed')).not.toContain(Haptics.AndroidHaptics.Reject);
    expect(androidChainFor('rejected')).toContain(Haptics.AndroidHaptics.Reject);
  });
});

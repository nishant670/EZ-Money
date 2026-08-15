import type { AudioRecorder } from 'expo-audio';
import { useEffect } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { normalizeMeteringDb } from '@/lib/audio-level';

/**
 * The live microphone level, as a Reanimated shared value in 0..1.
 *
 * ## Why this does not use `useAudioRecorderState`
 *
 * `expo-audio` ships a hook that polls the recorder and returns its status as
 * React state. Pointed at metering it would re-render the whole Home tree ten
 * times a second while recording — Home holds the feed, the month strip and
 * the collapsing capture card — to move one ring. That is the frame drop the
 * task is trying to avoid, caused by the fix for it.
 *
 * So the level never becomes React state. The poll writes straight into a
 * shared value and the rings read it from a worklet, which means the whole
 * path from microphone to pixel crosses the JS thread exactly once per sample
 * and re-renders nothing.
 *
 * There is a second reason not to run both: on Android `metering` comes from
 * `MediaRecorder.getMaxAmplitude()`, which reports the peak *since the last
 * call* and resets on read. Two pollers would each see roughly half the
 * signal, and which one saw a given shout would be a race.
 */

/**
 * How often the level is sampled. Also the Android metering window, per the
 * note above — short enough that a sample means "just now" rather than "at
 * some point recently", which is what makes the ring track a voice instead of
 * lagging behind it.
 */
const SAMPLE_INTERVAL_MS = 80;

/**
 * A level meter that rises and falls at the same rate reads as mush. Attack is
 * roughly one sample, so a syllable lands immediately; release is `base`, so
 * the ring settles through the gaps between words rather than strobing at
 * them.
 */
const ATTACK_MS = SAMPLE_INTERVAL_MS;
const RELEASE_MS = Motion.duration.base;

export function useAudioLevel(
  recorder: AudioRecorder | null | undefined,
  isActive: boolean
): SharedValue<number> {
  const level = useSharedValue(0);

  useEffect(() => {
    if (!isActive || !recorder) {
      level.value = withTiming(0, { duration: RELEASE_MS });
      return undefined;
    }

    const interval = setInterval(() => {
      let next = 0;
      try {
        next = normalizeMeteringDb(recorder.getStatus().metering);
      } catch {
        // The recorder can be torn down between the tick being scheduled and
        // it running. A missed sample is a slightly stale ring, not an error
        // worth surfacing on the capture screen.
        return;
      }
      level.value = withTiming(next, {
        duration: next > level.value ? ATTACK_MS : RELEASE_MS,
      });
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      level.value = withTiming(0, { duration: RELEASE_MS });
    };
  }, [isActive, level, recorder]);

  return level;
}

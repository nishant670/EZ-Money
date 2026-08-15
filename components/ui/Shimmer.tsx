import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * A loading placeholder shaped like the thing that is coming.
 *
 * A spinner says "wait"; a placeholder says "wait, and here is what for" — and
 * because it occupies the same space with the same shape, the content does not
 * shove the layout around when it lands. That is the whole reason it beats the
 * `ActivityIndicator` this replaces on the parse call.
 *
 * The sweep is one shared value per block, on the UI thread. Under reduced
 * motion the block simply holds its tint: still a placeholder, still the right
 * shape, just not moving.
 */

/** One pass of the highlight across a block. A cadence, not a response time. */
const SWEEP_MS = 1200;

/** Rest tint, and how much brighter the moving band is over it. */
const BASE_OPACITY = 0.07;
const SWEEP_OPACITY = 0.14;

type ShimmerProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  /**
   * Every block answers to `skeleton-block` by default, which is what lets a
   * test ask "is this frame full of placeholders" without reaching for the
   * component type through an UNSAFE query.
   */
  testID?: string;
  /**
   * Staggers the sweep between blocks. Without it a stack of placeholders
   * pulses in perfect unison, which reads as one flashing panel rather than
   * several things loading.
   */
  index?: number;
};

export function Shimmer({
  width = '100%',
  height = 14,
  radius,
  style,
  index = 0,
  testID = 'skeleton-block',
}: ShimmerProps) {
  const theme = useThemeTokens();
  const motion = useMotion();
  const sweep = useSharedValue(0);
  const isDark = theme.mode === 'dark';
  const tint = isDark ? '#FFFFFF' : '#2D2D2D';

  useEffect(() => {
    if (motion.reduced) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return undefined;
    }

    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false
    );

    return () => cancelAnimation(sweep);
  }, [motion.reduced, sweep]);

  const sweepStyle = useAnimatedStyle(() => {
    if (motion.reduced) return { opacity: 0 };
    // Offsetting by index inside the worklet rather than delaying the start
    // keeps every block on one clock — same reasoning as the mic rings.
    const phase = (sweep.value + index * 0.18) % 1;
    return { opacity: interpolate(phase, [0, 0.5, 1], [0, SWEEP_OPACITY, 0]) };
  }, [index, motion.reduced]);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? Math.min(height / 2, theme.radius.xs),
          backgroundColor: tint,
          opacity: BASE_OPACITY,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: tint, borderRadius: radius ?? height / 2 }, sweepStyle]}
      />
    </View>
  );
}

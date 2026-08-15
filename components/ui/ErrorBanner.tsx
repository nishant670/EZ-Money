import { useEffect } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getFriendlyErrorMessage } from '@/lib/api-error';

/**
 * The one way this app says something went wrong in place.
 *
 * Eleven screens each spelled their own red panel — the same border, the same
 * tint, the same centred sentence, and eleven chances to disagree about whether
 * it offers a retry. They agree now, and the agreement is worth more than the
 * eleven lines it saves: an error that looks slightly different each time it
 * appears reads as a different, unfamiliar failure each time.
 *
 * ## Why it arrives rather than appears
 *
 * A banner that is simply *there* on the next frame is indistinguishable from
 * one that was always there and went unread — the eye has nothing to catch. It
 * drops in from 8px above and fades, which is the smallest movement that still
 * registers as "this is new". It is deliberately not a slide from off-screen:
 * this is a line of text explaining a failure, not a notification demanding the
 * screen, and the distance is what carries that difference.
 *
 * The entrance re-runs when the message changes, because a *second* failure
 * with different wording is also new — a silent text swap inside a banner
 * already on screen is the thing this is meant to prevent.
 */

const BANNER_DROP = 8;

type ErrorBannerProps = {
  /** Raw error text. Passed through `getFriendlyErrorMessage` here, once. */
  message: string;
  /** Omit it and the banner is just an explanation — right when the screen
   *  behind it still has content and nothing to re-fetch. */
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
  testID?: string;
};

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
  style,
  testID = 'error-banner',
}: ErrorBannerProps) {
  const theme = useThemeTokens();
  const motion = useMotion();
  const isDark = theme.mode === 'dark';
  const arrival = useSharedValue(0);
  const text = getFriendlyErrorMessage(message, message);

  useEffect(() => {
    arrival.value = 0;
    arrival.value = withTiming(1, motion.enter('base'));
  }, [arrival, motion, text]);

  const arrivalStyle = useAnimatedStyle(() => ({
    opacity: arrival.value,
    transform: [{ translateY: interpolate(arrival.value, [0, 1], [-BANNER_DROP, 0]) }],
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(153,27,27,0.3)' : '#FEE2E2',
          backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#FEF2F2',
          padding: theme.spacing.md,
        },
        style,
        arrivalStyle,
      ]}>
      <ThemedText
        style={{
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
          color: isDark ? '#FCA5A5' : '#DC2626',
        }}>
        {text}
      </ThemedText>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{ marginTop: 8, minHeight: 24, alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accent }}>
            {retryLabel}
          </ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );
}

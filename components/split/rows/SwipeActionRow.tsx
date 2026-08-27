import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { haptics } from '@/lib/haptics';

export type SplitSwipeAction = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: 'default' | 'destructive';
  onPress: () => void;
};

const ACTION_WIDTH = 76;
const RESISTANCE = 0.2;
const SNAP_FRACTION = 0.4;
const ROW_RADIUS = 24;

/**
 * The Split row counterpart to TransactionItem's swipe stage.
 *
 * It deliberately shares that row's gesture contract: horizontal intent wins
 * at 12px, vertical intent yields to the list at 12px, over-pulls move at one
 * fifth speed, and a 40% reveal commits. Open state belongs to the list so one
 * row opening closes the previous row rather than leaving several destructive
 * choices exposed at once.
 */
export function SwipeActionRow({
  actions,
  open,
  onOpenChange,
  children,
}: {
  actions: SplitSwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const theme = useThemeTokens().colors;
  const motion = useMotion();
  const distance = ACTION_WIDTH * actions.length;
  const swipe = useSharedValue(0);
  const [engaged, setEngaged] = useState(open);

  useEffect(() => {
    if (actions.length === 0) return;
    swipe.value = motion.springTo(open ? -distance : 0);
    setEngaged(open);
  }, [actions.length, distance, motion, open, swipe]);

  const pan = Gesture.Pan()
    .enabled(actions.length > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      runOnJS(setEngaged)(true);
    })
    .onUpdate((event) => {
      const from = open ? -distance : 0;
      const next = from + event.translationX;
      if (next < -distance) {
        swipe.value = -distance + (next + distance) * RESISTANCE;
      } else if (next > 0) {
        swipe.value = next * RESISTANCE;
      } else {
        swipe.value = next;
      }
    })
    .onEnd(() => {
      const nextOpen = swipe.value <= -distance * SNAP_FRACTION;
      swipe.value = motion.springTo(nextOpen ? -distance : 0);
      runOnJS(haptics.select)();
      runOnJS(onOpenChange)(nextOpen);
      if (!nextOpen) runOnJS(setEngaged)(false);
    });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipe.value }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipe.value, [0, -Math.max(distance, 1) * 0.6], [0, 1], 'clamp'),
  }));

  if (actions.length === 0) return <>{children}</>;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.stage, engaged && styles.clipped]}>
        <Animated.View
          style={[styles.actions, { width: distance, borderRadius: ROW_RADIUS }, actionsStyle]}>
          {actions.map((action) => {
            const destructive = action.tone === 'destructive';
            const backgroundColor = destructive ? theme.negative : theme.secondary;
            const color = destructive ? theme.onNegative : theme.accent;
            return (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  haptics.select();
                  onOpenChange(false);
                  action.onPress();
                }}
                style={[styles.action, { backgroundColor }]}>
                <MaterialCommunityIcons name={action.icon} size={21} color={color} />
                <ThemedText variant="micro" style={{ color }}>
                  {action.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </Animated.View>
        <Animated.View style={frontStyle}>
          {children}
          {open ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close row actions"
              onPress={() => onOpenChange(false)}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    borderRadius: ROW_RADIUS,
  },
  clipped: {
    overflow: 'hidden',
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import Animated, { SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * The push transition for split's three full-screen screens — group detail,
 * members, settings.
 *
 * They used to lean on `Modal`'s built-in slide, which was dropped when the
 * feature moved onto the app's own motion vocabulary. Dropping it alone was a
 * regression: React Native's `Modal` defaults to `"none"`, so a group detail
 * that used to push in started appearing instantly, which reads as a glitch
 * rather than as speed.
 *
 * `animationType` is not the way back. It is a fixed platform curve at a fixed
 * platform duration, so it cannot honour `Motion.duration.sheet` and — the part
 * that actually matters — it cannot be turned off for reduced motion. This runs
 * the same travel through Reanimated instead, off the same token the bottom
 * sheet uses, and degrades to no animation at all when the user has asked for
 * that.
 *
 * ## Why it owns the close
 *
 * An exit animation needs the leaving view to still be mounted while it plays,
 * and these modals are rendered conditionally by the screen above them — the
 * moment `onClose` runs, the parent drops them and there is nothing left to
 * animate. So `close` is handed *down* to the content instead: it plays the
 * exit, and only then tells the parent. Children get it as a render prop rather
 * than a prop on a wrapper element, because both the header's back button and
 * Android's hardware back have to go through the same door.
 */
export function SplitFullScreenModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const theme = useThemeTokens().colors;
  const motion = useMotion();
  const duration = motion.duration('sheet');
  const exitDuration = motion.exitDuration('sheet');
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (closeTimer.current) return;
    if (exitDuration === 0) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, exitDuration);
  }, [exitDuration, onClose]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // `transparent` so the screen underneath stays visible for the length of the
  // travel — a push that slides in over a blank white field is not a push. The
  // sliding view carries the opaque background instead.
  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      {closing ? null : (
        <Animated.View
          style={{ flex: 1, backgroundColor: theme.background }}
          entering={duration === 0 ? undefined : SlideInRight.duration(duration)}
          exiting={exitDuration === 0 ? undefined : SlideOutRight.duration(exitDuration)}>
          <SafeAreaView
            className="flex-1"
            edges={['top', 'left', 'right']}
            style={{ backgroundColor: theme.background }}>
            {children(close)}
          </SafeAreaView>
        </Animated.View>
      )}
    </Modal>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

import { Motion } from '@/constants/theme';
import { useMotion } from '@/hooks/use-motion';

/**
 * The sheet runs on legacy `Animated`, so its curves are built from the raw
 * control points in `Motion.ease` rather than through `useMotion()`, whose
 * easings are Reanimated worklets and would not survive the trip. The durations
 * still come from the hook, which is what carries the reduced-motion degrade.
 */
const ENTER_EASING = Easing.bezier(...Motion.ease.standard);
const EXIT_EASING = Easing.bezier(...Motion.ease.exit);

type AnimatedBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropOpacity?: number;
  avoidKeyboard?: boolean;
  onDismiss?: () => void;
};

const SHEET_OFFSET = 48;

export function AnimatedBottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  containerStyle,
  backdropOpacity = 0.4,
  avoidKeyboard = false,
  onDismiss,
}: AnimatedBottomSheetProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const motion = useMotion();
  const enterDuration = motion.duration('sheet');
  const exitDurationMs = motion.exitDuration('sheet');

  useEffect(() => {
    let active = true;
    let animationFrame: number | null = null;
    let animation: Animated.CompositeAnimation | null = null;

    if (visible) {
      setIsMounted(true);
      animationFrame = requestAnimationFrame(() => {
        if (!active) return;
        animation = Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: enterDuration,
            easing: ENTER_EASING,
            useNativeDriver: true,
          }),
        ]);
        animation.start();
      });
    } else {
      animation = Animated.timing(progress, {
        toValue: 0,
        duration: exitDurationMs,
        easing: EXIT_EASING,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (active && finished) {
          setIsMounted(false);
          onDismiss?.();
        }
      });
    }

    return () => {
      active = false;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animation?.stop();
    };
  }, [enterDuration, exitDurationMs, onDismiss, progress, visible]);

  /**
   * The sheet lifts itself rather than delegating to `KeyboardAvoidingView`.
   *
   * A sheet lives inside a `Modal`, which on Android is its own window that
   * `adjustResize` never reaches — and `KeyboardAvoidingView` has no Android
   * behavior to fall back on, so the keyboard simply covered the form and the
   * user typed into fields they could not see. Measuring the keyboard and
   * padding the sheet up by it is the one approach that behaves the same on
   * both platforms and inside a modal.
   */
  useEffect(() => {
    if (!avoidKeyboard) {
      setKeyboardInset(0);
      return;
    }
    // iOS reports the keyboard before it animates, Android only once it is up.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [avoidKeyboard]);

  if (!isMounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_OFFSET, 0],
  });

  const content = (
    <View
      testID="bottom-sheet-container"
      style={[
        { flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardInset },
        containerStyle,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close sheet"
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <Animated.View
        style={[
          {
            opacity: progress,
            transform: [{ translateY }],
            // Never taller than the room left above the keyboard: whatever
            // inside the sheet is allowed to shrink is what gives way.
            flexShrink: 1,
          },
          sheetStyle,
        ]}>
        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal transparent visible={isMounted} animationType="none" onRequestClose={onClose}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'black',
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, backdropOpacity],
          }),
        }}
      />
      {content}
    </Modal>
  );
}

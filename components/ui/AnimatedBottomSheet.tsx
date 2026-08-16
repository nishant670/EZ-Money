import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
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
  const progress = useRef(new Animated.Value(0)).current;
  const motion = useMotion();
  const enterDuration = motion.duration('sheet');
  const exitDurationMs = motion.exitDuration('sheet');

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: enterDuration,
            easing: ENTER_EASING,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: exitDurationMs,
      easing: EXIT_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
        onDismiss?.();
      }
    });
  }, [enterDuration, exitDurationMs, onDismiss, progress, visible]);

  if (!isMounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_OFFSET, 0],
  });

  const content = (
    <View style={[{ flex: 1, justifyContent: 'flex-end' }, containerStyle]}>
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
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}

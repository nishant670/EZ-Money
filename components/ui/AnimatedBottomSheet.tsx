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

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
        onDismiss?.();
      }
    });
  }, [onDismiss, progress, visible]);

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

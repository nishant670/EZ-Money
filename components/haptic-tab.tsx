import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { style, onPressIn, onPressOut, ...pressableProps } = props;

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <PlatformPressable
        {...pressableProps}
        style={{ flex: 1 }}
        onPressIn={(ev) => {
          Animated.spring(scale, {
            toValue: 0.94,
            useNativeDriver: true,
            speed: 24,
            bounciness: 6,
          }).start();
          if (process.env.EXPO_OS === 'ios') {
            // Add a soft haptic feedback when pressing down on the tabs.
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPressIn?.(ev);
        }}
        onPressOut={(ev) => {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 8,
          }).start();
          onPressOut?.(ev);
        }}
      />
    </Animated.View>
  );
}

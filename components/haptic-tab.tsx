import { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import { useRef } from 'react';
import { Animated } from 'react-native';

import { haptics } from '@/lib/haptics';

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
          // This used to be gated on `EXPO_OS === 'ios'`, which meant the
          // app's one wired haptic did nothing on the platform the audit was
          // run on. `haptics.select()` answers on both.
          haptics.select();
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

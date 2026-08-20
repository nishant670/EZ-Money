import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
}

export function OnboardingScreenWrapper({ children, style, ...props }: OnboardingScreenWrapperProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  // `SafeAreaView` looks like the obvious thing to use here and was, until a
  // Pixel 10 showed what it actually does: it is a *native* view that measures
  // the window insets itself and pads accordingly, which it cannot do until
  // Android has dispatched them. Every screen under it therefore laid out once
  // with no status bar and again with one — on that device a 173px jump of the
  // entire screen, buttons included, landing at no fixed moment after the user
  // was already looking at it and reaching for something.
  //
  // The hook reads the same numbers from JS, and the provider in the root
  // layout is seeded with `initialWindowMetrics`, so they are right on the
  // first frame and the second pass never happens.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, style]} {...props}>
      <View
        style={[
          styles.safeArea,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});

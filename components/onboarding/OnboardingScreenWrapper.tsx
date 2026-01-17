import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OnboardingScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
}

export function OnboardingScreenWrapper({ children, style, ...props }: OnboardingScreenWrapperProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, style]} {...props}>
      <SafeAreaView style={styles.safeArea}>
        {children}
      </SafeAreaView>
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

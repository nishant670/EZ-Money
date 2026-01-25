import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { FinnriSplashScreen } from '@/components/SplashScreen';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { useAuthStore } from '@/hooks/use-auth-store';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAppReady, setIsAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const { user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Simulate asset loading or just wait for the custom splash
    const prepare = async () => {
      try {
        // Artificial delay to show native splash for a moment if needed
        // but SplashScreen.hideAsync() is usually called when fonts are ready.
        setIsAppReady(true);
      } catch (e) {
        console.warn(e);
      }
    };
    prepare();
  }, []);

  const handleCustomSplashComplete = () => {
    setShowCustomSplash(false);

    // Navigation logic after splash
    if (user) {
      if (user.has_pin || user.biometrics_enabled) {
        router.replace('/lock');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      router.replace('/onboarding');
    }
  };

  useEffect(() => {
    if (isAppReady) {
      // Hide native splash once the app is "ready" 
      // (the custom splash will be visible on top)
      SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  // Session check logic
  useEffect(() => {
    if (!isAppReady || showCustomSplash) return;

    // Check if user is logged in via store
    // We need to import the store here, but hooks inside component is fine.
    // However, we need to be careful with navigation readiness.
    // The RootLayout is a component, so we can use hooks.
  }, [isAppReady, showCustomSplash]);

  if (!isAppReady) {
    return null;
  }


  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {showCustomSplash && (
        <FinnriSplashScreen onAnimationComplete={handleCustomSplashComplete} />
      )}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
        <Stack.Screen
          name="accounts/manage"
          options={{ presentation: 'modal', title: 'Account', headerShown: false }}
        />
        <Stack.Screen
          name="auth"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="transactions/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="lock"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

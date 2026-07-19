import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import 'react-native-reanimated';

import { FinnriSplashScreen } from '@/components/SplashScreen';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { installApiSessionGuard } from '@/lib/api-session';
import { hasCompletedOnboarding } from '@/lib/onboarding';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { setColorScheme } = useNativeWindColorScheme();
  const themeTokens = useThemeTokens();
  const [isAppReady, setIsAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const navigationTheme = useMemo(
    () => ({
      ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        primary: themeTokens.colors.accent,
        background: themeTokens.colors.background,
        card: themeTokens.colors.card,
        text: themeTokens.colors.text,
        border: themeTokens.colors.border,
      },
    }),
    [colorScheme, themeTokens.colors]
  );

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

  const routeAfterSplash = async () => {
    const currentUser = useAuthStore.getState().user;

    if (currentUser) {
      if (currentUser.has_pin || currentUser.biometrics_enabled) {
        router.replace('/lock');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    if (await hasCompletedOnboarding()) {
      router.replace('/auth');
    } else {
      router.replace('/onboarding');
    }
  };

  const handleCustomSplashComplete = () => {
    setShowCustomSplash(false);

    if (!useAuthStore.persist.hasHydrated()) {
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        unsubscribe();
        routeAfterSplash();
      });
      return;
    }

    routeAfterSplash();
  };

  useEffect(() => {
    if (isAppReady) {
      // Hide native splash once the app is "ready" 
      // (the custom splash will be visible on top)
      SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  useEffect(() => {
    return installApiSessionGuard(() => {
      clearAuth();
      router.replace('/auth');
    });
  }, [clearAuth, router]);

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);

  if (!isAppReady) {
    return null;
  }


  return (
    <ThemeProvider value={navigationTheme}>
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
        <Stack.Screen name="accounts/[id]" options={{ headerShown: false }} />
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
        <Stack.Screen name="security" options={{ headerShown: false }} />
        <Stack.Screen name="change-pin" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="budgets" options={{ headerShown: false }} />
        <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
        <Stack.Screen name="about-finnri" options={{ headerShown: false }} />
        <Stack.Screen name="help-support" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

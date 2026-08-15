import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Must load before any component calls setColorScheme: NativeWind reads the
// compiled darkMode setting from this stylesheet and throws without it.
import '../global.css';

import { FinnriSplashScreen } from '@/components/SplashScreen';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMotion } from '@/hooks/use-motion';
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
  const motion = useMotion();
  const [isAppReady, setIsAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const { clearAuth, token } = useAuthStore();
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

  useEffect(() => {
    if (!token || Constants.appOwnership === 'expo') return;

    let responseSubscription: { remove: () => void } | undefined;
    let cancelled = false;
    void Promise.all([import('expo-notifications'), import('@/lib/push-notifications')])
      .then(([Notifications, { registerForPushNotifications }]) => {
        if (cancelled) return;
        void registerForPushNotifications(token).catch(() => undefined);
        responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
          router.push('/notifications');
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      responseSubscription?.remove();
    };
  }, [router, token]);

  if (!isAppReady) {
    return null;
  }

  return (
    // The gesture layer the audit found missing entirely. `react-native-gesture-handler`
    // has been a dependency all along — react-navigation pulls it in — but nothing in
    // the app had ever imported it, and on Android its handlers do nothing at all
    // unless a `GestureHandlerRootView` is above them. One root here, so a row on any
    // screen can be swiped without each screen remembering to provide one.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
      {showCustomSplash && <FinnriSplashScreen onAnimationComplete={handleCustomSplashComplete} />}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // A native stack has one duration for both directions, so the two
          // halves of the `sheet` token cannot both apply — and the exit is the
          // half that binds. A push that is slightly quicker than the vocabulary
          // asks for costs nothing; a pop held to entrance length is the lag
          // `EXIT_RATIO` exists to prevent, on the one gesture the user makes
          // most. 240ms is `sheet`'s exit exactly, which is also the number the
          // audit asked for, arrived at from the tokens rather than by hand.
          animationDuration: motion.exitDuration('sheet'),
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: themeTokens.colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            title: 'Modal',
            headerShown: true,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="accounts/manage"
          options={{ presentation: 'modal', title: 'Account', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="accounts/[id]" />
        <Stack.Screen name="auth" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="transactions/index" />
        <Stack.Screen name="lock" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="security" />
        <Stack.Screen name="change-pin" />
        <Stack.Screen name="invite/split/[token]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="insight-detail" />
        <Stack.Screen name="recurring-review" />
        <Stack.Screen name="weekly-review" />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="billing" />
        <Stack.Screen name="ai-usage" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="about-finnri" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="upcoming" />
        {/* The one screen in the app that does not slide, and C9 is the reason.
            Its icon and amount are drawn on top of where the tapped row's were
            and released towards where they belong, and two elements can only
            read as one object if the screens behind them are not also sliding
            past each other — a push turns the travel into two things moving in
            different directions at once.

            Under reduced motion there is no travel to coordinate, so the screen
            goes back to the push every other screen uses. That is the degrade
            the task asks for: the plain push, not a half-played transition. */}
        <Stack.Screen
          name="entry/[id]"
          options={{ animation: motion.reduced ? 'slide_from_right' : 'fade' }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

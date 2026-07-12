import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { getMoodIconName } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const iconStyle = theme.mood.iconStyle;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            borderTopWidth: 0,
            elevation: 0,
            height: 80,
            paddingBottom: 20,
            backgroundColor: colors.card,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 10,
          },
          default: {
            backgroundColor: colors.card,
            borderTopWidth: 0,
            elevation: 0,
            height: 70,
            paddingBottom: 10,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              size={28}
              name={getMoodIconName(focused ? 'home' : 'home-outline', iconStyle, focused) as any}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insight"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              size={28}
              name={getMoodIconName('chart-bar', iconStyle, focused) as any}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              size={28}
              name={getMoodIconName(focused ? 'wallet' : 'wallet-outline', iconStyle, focused) as any}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="split"
        options={{
          title: 'Split',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              size={28}
              name={getMoodIconName(focused ? 'account-multiple' : 'account-multiple-outline', iconStyle, focused) as any}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              size={28}
              name={getMoodIconName(focused ? 'account' : 'account-outline', iconStyle, focused) as any}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="app-mood"
        options={{
          href: null,
          title: 'App Mood',
        }}
      />
    </Tabs>
  );
}

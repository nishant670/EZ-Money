import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
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
                backgroundColor: theme.card,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            default: {
                backgroundColor: theme.card,
                borderTopWidth: 0,
                elevation: 0,
                height: 70,
                paddingBottom: 10,
            }
        })
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={28} name={focused ? "home" : "home-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insight"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={28} name={focused ? "chart-bar" : "chart-bar"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts', 
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={28} name={focused ? "wallet" : "wallet-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={28} name={focused ? "account" : "account-outline"} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

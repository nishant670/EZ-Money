import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Fonts, type IconStyle } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type TabIconProps = {
  activeName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  inactiveName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  focused: boolean;
  color: string;
  iconStyle: IconStyle;
};

function TabIcon({ activeName, inactiveName, focused, color, iconStyle }: TabIconProps) {
  const name = focused && iconStyle !== 'minimal' ? activeName : inactiveName;

  return (
    <View style={styles.iconStack}>
      <View style={[styles.activeMarker, focused && { backgroundColor: color }]} />
      <View style={[styles.iconFrame, focused && styles.activeIconFrame]}>
        <MaterialCommunityIcons size={focused ? 26 : 23} name={name} color={color} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const iconStyle = theme.mood.iconStyle;
  const inactiveTint = theme.mode === 'dark' ? '#ABA5B0' : '#756D78';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: inactiveTint,
        headerShown: false,
        animation: 'shift',
        tabBarButton: HapticTab,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: Platform.select({
          ios: {
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 0,
            height: 70,
            paddingTop: 6,
            paddingBottom: 10,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            shadowColor: '#1D1420',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
          },
          default: {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            elevation: 8,
            height: 64,
            paddingTop: 5,
            paddingBottom: 7,
          },
        }),
      }}>
      <Tabs.Screen
        name="insight"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="chart-timeline-variant-shimmer"
              inactiveName="chart-timeline-variant"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="wallet-bifold"
              inactiveName="wallet-bifold-outline"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="home-variant"
              inactiveName="home-variant-outline"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="split"
        options={{
          title: 'Splits',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="account-multiple"
              inactiveName="account-multiple-outline"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="account-circle"
              inactiveName="account-circle-outline"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
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

const styles = StyleSheet.create({
  tabBarItem: {
    paddingTop: 1,
  },
  tabBarLabel: {
    fontFamily: Fonts.title,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -2,
  },
  iconStack: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    width: 36,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconFrame: {
    transform: [{ translateY: -1 }],
  },
  activeMarker: {
    width: 18,
    height: 3,
    borderRadius: 3,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
});

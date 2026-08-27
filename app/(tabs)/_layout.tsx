import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { SplitInvitePrompt } from '@/components/split/SplitInvitePrompt';
import {
  MARKER_LANE,
  TabMarker,
  TabMarkerProvider,
  TabRouteFocus,
  useTabMarkerAnchor,
} from '@/components/tab-marker';
import { Fonts, type IconStyle } from '@/constants/theme';
import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * The size the glyph is always rendered at, and what focus scales it to.
 *
 * The focused icon used to be *drawn* two points larger, which is a different
 * glyph rasterisation rather than a bigger one — there is no in-between to
 * animate, so it could only ever snap. One size, scaled, lands within a
 * quarter-pixel of where the old 26 did and can travel there on a spring.
 */
const ICON_SIZE = 23;
const ICON_FOCUSED_SCALE = 1.12;

type TabIconProps = {
  activeName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  inactiveName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** The screen's route name, which is how the marker keys this tab's frame. */
  route: string;
  focused: boolean;
  color: ColorValue;
  iconStyle: IconStyle;
};

function TabIcon({ activeName, inactiveName, route, focused, color, iconStyle }: TabIconProps) {
  const motion = useMotion();
  const anchor = useTabMarkerAnchor(route);
  const name = focused && iconStyle !== 'minimal' ? activeName : inactiveName;
  const scale = useSharedValue(focused ? ICON_FOCUSED_SCALE : 1);

  useEffect(() => {
    scale.value = motion.springTo(focused ? ICON_FOCUSED_SCALE : 1);
  }, [focused, motion, scale]);

  const iconStyleAnimated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View ref={anchor.ref} onLayout={anchor.onLayout} style={styles.iconStack}>
      <Animated.View style={[styles.iconFrame, iconStyleAnimated]}>
        <MaterialCommunityIcons size={ICON_SIZE} name={name} color={color} />
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  /**
   * The room the system's own bar takes at the bottom of the window.
   *
   * Android has been edge-to-edge since SDK 54 and there is no opting out, so
   * the tab bar is laid out over the gesture pill or the three-button bar
   * rather than above it. React Navigation already adds this inset itself — but
   * only when `tabBarStyle` names neither a `height` nor a `paddingBottom`, and
   * this bar names both, so the library's version was being overwritten and the
   * labels ended up underneath the system buttons. Adding it back here is what
   * keeps the bar tappable; the same applies to the iPhone home indicator.
   */
  const insets = useSafeAreaInsets();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const iconStyle = theme.mood.iconStyle;
  const inactiveTint = theme.mode === 'dark' ? '#ABA5B0' : '#756D78';

  return (
    // The provider sits outside the navigator because the two halves that feed
    // the marker — the icons and the bar background — are on different branches
    // of what the navigator renders, and this is their nearest common ancestor.
    <TabMarkerProvider>
    {/*
      * Mounted here rather than at the root so an invite can only interrupt
      * somebody already inside the app — never over the lock screen, auth, or
      * onboarding.
      */}
    <SplitInvitePrompt />
    <Tabs
      /*
       * Home is where Back goes, and where a cold launch starts.
       *
       * The tab router's default is `firstRoute`, which returns to
       * `routes[0]` — the first `Tabs.Screen` declared below, which is
       * Insights. So the device back button from Money, Splits or Profile
       * landed on a tab the user had not asked for and might never have
       * opened. The bar is ordered Insights · Money · Home · Splits · Profile
       * because Home belongs under the thumb, not first, so the first tab and
       * the home tab are different routes and the default cannot be right here.
       *
       * `initialRouteName` has to be spelled out for `initialRoute` to mean
       * anything: the router resolves it with `findIndex`, and falls back to
       * index 0 — Insights again — when the name matches nothing. It also
       * fixes a smaller thing, that the navigator used to mount on Insights and
       * be navigated to Home a frame later, because `/` resolves to `index`.
       */
      backBehavior="initialRoute"
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        // `TabRouteFocus` rides along here because this is the only place
        // rendered *inside* the navigator: it is what lets the pill read the
        // same focused route the icons are handed, rather than the URL.
        tabBarBackground: () => (
          <>
            <TabRouteFocus />
            <TabMarker color={colors.tint} />
          </>
        ),
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
            height: 70 + insets.bottom,
            paddingTop: 6,
            paddingBottom: 10 + insets.bottom,
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
            height: 64 + insets.bottom,
            paddingTop: 5,
            paddingBottom: 7 + insets.bottom,
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
              route="insight"
              inactiveName="chart-timeline-variant"
              focused={focused}
              color={color}
              iconStyle={iconStyle}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="wallet-bifold"
              route="money"
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
              route="index"
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
              route="split"
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
              route="profile"
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
          // No tab of its own, so no pill. `tabBarBackground` is read from the
          // *focused* screen's options, which makes opting out a property of
          // this screen rather than something the marker has to infer — and
          // stops the pill hovering under whichever tab the user arrived from.
          tabBarBackground: undefined,
        }}
      />
    </Tabs>
    </TabMarkerProvider>
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
    // The room the five static pills used to take up, kept behind now that the
    // one travelling pill is drawn from the bar side. Without it every icon in
    // the bar rises by half a lane.
    paddingTop: MARKER_LANE,
  },
  iconFrame: {
    width: 36,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

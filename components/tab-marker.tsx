import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';

/**
 * The active-tab pill, as one pill that travels.
 *
 * There were five of them before — one per tab, transparent until its tab was
 * focused — so switching tabs made one vanish and another appear two hundred
 * pixels away. Nothing connected the two, and the eye had to find the new one
 * rather than follow the old one. It is a single view now, drawn once for the
 * whole bar and moved to whichever tab is focused.
 *
 * ## It rides in `tabBarBackground`, and the tabs post their own coordinates
 *
 * The pill has to be drawn in the tab bar's coordinate space to move across it,
 * and the only public seam into that space is `tabBarBackground` — an absolute
 * fill that React Navigation renders behind the tab items and above the bar's
 * own colour, with pointer events already off. The alternative was replacing
 * the whole `tabBar`, which means importing `BottomTabBar` from inside
 * `expo-router/build`, and reimplementing what the default bar does with
 * labels, insets and accessibility.
 *
 * That leaves the pill unable to see where the tabs are — `tabBarBackground` is
 * a sibling of the tab list, not its parent. So the measurement runs the other
 * way: each tab's icon reports its own frame when it takes focus, the bar
 * reports its own, and the difference is where the pill goes. **Nothing here
 * assumes the tabs are equally wide, or that the icon sits a particular
 * distance down the bar.** Both were tempting to hardcode and both are laid out
 * by React Navigation rather than by us — a guess would have been a number that
 * looked right on one device.
 *
 * A screen with no tab of its own (App Mood, which is `href: null`) simply does
 * not ask for the background, so the pill is absent there rather than left
 * hovering under the tab the user came from.
 */

/** The pill itself — the same 18×3 the five static ones were. */
export const MARKER_WIDTH = 18;
const MARKER_HEIGHT = 3;

/**
 * The strip at the top of a tab's icon stack that the pill travels along.
 *
 * The pill used to live *in* the stack and take up room in it, so the space it
 * occupied has to stay behind now that it has moved out — otherwise every icon
 * in the bar shifts up by half of it. The stack reserves the lane; the pill is
 * drawn into it from the other side.
 */
export const MARKER_LANE = MARKER_HEIGHT + 2;

/** A frame in window coordinates. Only `x`, `y` and `width` are ever used. */
export type Frame = { x: number; y: number; width: number };

/**
 * Where the pill sits inside the bar, given the two measured frames.
 *
 * Both are in window coordinates — the tab reports its own and so does the
 * bar — so the subtraction is what turns them into a position inside the bar.
 * It is pulled out here because it is the whole of the geometry, and the rest
 * of this file is plumbing that a test cannot reach.
 */
export function markerOffset(tab: Frame, bar: Frame) {
  return {
    x: tab.x - bar.x + tab.width / 2 - MARKER_WIDTH / 2,
    y: tab.y - bar.y,
  };
}

type TabMarkerStore = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** 0 until both frames have landed, so the pill never flashes at the origin. */
  shown: SharedValue<number>;
  reportTab: (frame: Frame) => void;
  reportBar: (frame: Frame) => void;
};

const TabMarkerContext = createContext<TabMarkerStore | null>(null);

function useTabMarkerStore(): TabMarkerStore {
  const store = useContext(TabMarkerContext);
  if (!store) {
    throw new Error('Tab marker used outside <TabMarkerProvider>. Wrap the tab navigator in one.');
  }
  return store;
}

/**
 * Holds the pill's position. Wraps the tab navigator, because the two halves
 * that report into it — the icons and the bar background — are on different
 * branches of what the navigator renders.
 */
export function TabMarkerProvider({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);

  const tabFrame = useRef<Frame | null>(null);
  const barFrame = useRef<Frame | null>(null);
  // The first placement is a jump, every one after it is a journey: a pill that
  // slid in from the left edge on launch would be announcing a tab change that
  // never happened.
  const hasPlaced = useRef(false);

  const place = useCallback(() => {
    const tab = tabFrame.current;
    const bar = barFrame.current;
    if (!tab || !bar) return;

    const next = markerOffset(tab, bar);
    // Constant across tabs, so it is assigned rather than animated — springing
    // a value to itself is a frame of work to move nothing.
    y.value = next.y;
    shown.value = 1;

    if (!hasPlaced.current) {
      hasPlaced.current = true;
      x.value = next.x;
      return;
    }
    // The press spring, the same one the icon uses, so the pill and the icon it
    // is under arrive together — they are one answer to one tap.
    x.value = motion.springTo(next.x);
  }, [motion, shown, x, y]);

  const store = useMemo<TabMarkerStore>(
    () => ({
      x,
      y,
      shown,
      reportTab: (frame) => {
        tabFrame.current = frame;
        place();
      },
      reportBar: (frame) => {
        barFrame.current = frame;
        place();
      },
    }),
    [place, shown, x, y]
  );

  return <TabMarkerContext value={store}>{children}</TabMarkerContext>;
}

/**
 * Attaches a tab's icon stack to the marker: spread the result onto the view
 * whose top edge the pill should sit on.
 *
 * It reports on layout and again whenever the tab takes focus. The second is
 * the one that matters and it costs nothing — the frame has not changed, so the
 * measurement is already correct by the time focus moves.
 */
export function useTabMarkerAnchor(focused: boolean) {
  const { reportTab } = useTabMarkerStore();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    if (!focused) return;
    ref.current?.measureInWindow((x, y, width) => reportTab({ x, y, width }));
  }, [focused, reportTab]);

  useEffect(measure, [measure]);

  return { ref, onLayout: measure };
}

/** The pill. Give this to `tabBarBackground`. */
export function TabMarker({ color }: { color: string }) {
  const { x, y, shown, reportBar } = useTabMarkerStore();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((left, top, width) => reportBar({ x: left, y: top, width }));
  }, [reportBar]);

  const markerStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <View
      ref={ref}
      onLayout={measure}
      testID="tab-marker"
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Animated.View
        style={[styles.marker, { backgroundColor: color }, markerStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    borderRadius: MARKER_HEIGHT,
  },
});

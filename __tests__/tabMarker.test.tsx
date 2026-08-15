import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import {
  MARKER_LANE,
  MARKER_WIDTH,
  TabMarker,
  TabMarkerProvider,
  markerOffset,
  useTabMarkerAnchor,
  type Frame,
} from '@/components/tab-marker';

/**
 * A five-tab bar, 400 wide, sitting 700 down the window with its icon stacks 12
 * further down — the shape the real thing has, in the units the two halves
 * actually report in.
 */
const bar: Frame = { x: 0, y: 700, width: 400 };
const tabAt = (index: number): Frame => ({ x: index * 80, y: 712, width: 80 });

describe('marker geometry', () => {
  it('centres the pill on the tab', () => {
    // Third of five: centre at 200, so an 18-wide pill starts at 191.
    expect(markerOffset(tabAt(2), bar).x).toBe(200 - MARKER_WIDTH / 2);
  });

  it('reports a position inside the bar, not inside the window', () => {
    // Both frames are measured in window coordinates, and a bar 700px down the
    // screen would otherwise put the pill 700px below the bar it lives in.
    expect(markerOffset(tabAt(0), bar).y).toBe(12);
  });

  it('follows tabs that are not all the same width', () => {
    // Nothing here computes a position from "bar width over tab count" — React
    // Navigation lays the items out and each one says where it landed, so a
    // wide label or a hidden tab cannot put the pill off-centre.
    const wide: Frame = { x: 100, y: 712, width: 140 };

    expect(markerOffset(wide, bar).x).toBe(170 - MARKER_WIDTH / 2);
  });

  it('reserves the lane it used to occupy inside the icon stack', () => {
    // The pill moved out of the stack and is drawn from the bar side now. If
    // the stack stopped reserving the space, every icon in the bar would rise.
    expect(MARKER_LANE).toBe(5);
  });
});

/**
 * Frames by `testID`.
 *
 * React Native's Jest mock gives every `View` a `measureInWindow` that accepts
 * a callback and never calls it, which is the one method this whole component
 * is built on — so it is replaced with one that answers from this table. The
 * marker asks the platform where things are precisely so that it does not have
 * to assume, and a test that cannot answer would be testing nothing.
 */
const frames: Record<string, Frame> = { 'tab-marker': bar };

beforeEach(() => {
  jest
    .spyOn(View.prototype, 'measureInWindow')
    .mockImplementation(function (this: { props?: { testID?: string } }, callback) {
      const frame = frames[this.props?.testID ?? ''];
      if (frame) callback(frame.x, frame.y, frame.width, 32);
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** A tab whose icon stack measures to `frame`. */
function FakeTab({ id, focused, frame }: { id: string; focused: boolean; frame: Frame }) {
  frames[id] = frame;
  const anchor = useTabMarkerAnchor(focused);

  return <View ref={anchor.ref} onLayout={anchor.onLayout} testID={id} />;
}

/**
 * Every tree here is built by a factory rather than held in a variable.
 *
 * Re-rendering the *same* element object is a bailout: React compares by
 * reference, skips the subtree, and the assertion reads a stale style while the
 * component under test is working perfectly.
 */
type Tree = () => React.ReactElement;

/**
 * Mounts the bar, then lays it out the way the platform would.
 *
 * `onLayout` does not fire under `react-test-renderer`, and it is the event the
 * bar half of the measurement hangs off, so the test has to send it.
 */
const mount = async (tree: Tree) => {
  const screen = await render(tree());
  await act(async () => {
    fireEvent(screen.getByTestId('tab-marker'), 'layout');
  });
  return screen;
};

/**
 * The rendered pill, as a flat style object.
 *
 * The Reanimated fake evaluates `useAnimatedStyle` during render and returns a
 * plain object, so a shared value written *after* a render — which is what every
 * measurement callback does — only reaches the tree on the render after that.
 * Hence two: the first commits the new props and runs the effect that measures,
 * the second reads the value it wrote. Real Reanimated updates the view without
 * either, so both are artefacts of the fake rather than something the component
 * needs.
 */
const pillAfterRender = async (
  screen: { rerender: (ui: React.ReactElement) => void; toJSON: () => any },
  tree: Tree
) => {
  await act(async () => {
    screen.rerender(tree());
  });
  await act(async () => {
    screen.rerender(tree());
  });

  const find = (node: any): Record<string, any> | null => {
    if (!node) return null;
    const layers = ([] as any[]).concat(node.props?.style ?? []);
    if (layers.some((layer) => layer?.width === MARKER_WIDTH)) {
      return layers.reduce((merged, layer) => ({ ...merged, ...layer }), {});
    }
    for (const child of node.children ?? []) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };

  const style = find(screen.toJSON());
  if (!style) throw new Error('no pill in the tree');
  return {
    x: style.transform[0].translateX,
    y: style.transform[1].translateY,
    opacity: style.opacity,
  };
};

describe('the travelling pill', () => {
  it('stays invisible until both halves have reported', async () => {
    // The bar knows where it is and nothing else. A pill drawn now would sit at
    // the bar's own origin — the top-left corner, under no tab at all.
    const tree: Tree = () => (
      <TabMarkerProvider>
        <TabMarker color="#EF7C5B" />
      </TabMarkerProvider>
    );
    const screen = await mount(tree);

    expect((await pillAfterRender(screen, tree)).opacity).toBe(0);
  });

  it('lands on the focused tab once both have', async () => {
    const tree: Tree = () => (
      <TabMarkerProvider>
        <FakeTab id="tab-2" focused frame={tabAt(2)} />
        <TabMarker color="#EF7C5B" />
      </TabMarkerProvider>
    );
    const screen = await mount(tree);

    expect(await pillAfterRender(screen, tree)).toEqual({
      x: 200 - MARKER_WIDTH / 2,
      y: 12,
      opacity: 1,
    });
  });

  it('ignores the tabs that are not focused', async () => {
    // Two of the three icons measure to somewhere the pill must never go.
    const tree: Tree = () => (
      <TabMarkerProvider>
        <FakeTab id="tab-0" focused={false} frame={tabAt(0)} />
        <FakeTab id="tab-3" focused frame={tabAt(3)} />
        <FakeTab id="tab-4" focused={false} frame={tabAt(4)} />
        <TabMarker color="#EF7C5B" />
      </TabMarkerProvider>
    );
    const screen = await mount(tree);

    expect((await pillAfterRender(screen, tree)).x).toBe(280 - MARKER_WIDTH / 2);
  });

  it('moves when focus does, without waiting for a new layout', async () => {
    // Switching tabs relays out nothing — the icons are exactly where they
    // were. The pill has to move off the focus change alone.
    const focused = (index: number): Tree => () => (
      <TabMarkerProvider>
        <FakeTab id="tab-0" focused={index === 0} frame={tabAt(0)} />
        <FakeTab id="tab-4" focused={index === 4} frame={tabAt(4)} />
        <TabMarker color="#EF7C5B" />
      </TabMarkerProvider>
    );
    const screen = await mount(focused(0));

    expect((await pillAfterRender(screen, focused(0))).x).toBe(40 - MARKER_WIDTH / 2);
    expect((await pillAfterRender(screen, focused(4))).x).toBe(360 - MARKER_WIDTH / 2);
  });
});

import { render } from '@testing-library/react-native';
import React from 'react';

import { AccountDetailSkeleton, AccountListSkeleton } from '@/components/accounts/AccountSkeletons';
import { InsightsSkeleton } from '@/components/insights/InsightsSkeleton';
import {
  EntryDetailSkeleton,
  HistoryDetailSkeleton,
  TransactionListSkeleton,
} from '@/components/transactions/TransactionListSkeleton';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SkeletonRow, SkeletonRows } from '@/components/ui/Skeleton';
import { Motion } from '@/constants/theme';

/**
 * Counting blocks is how these assert "this frame is full of placeholders"
 * without pinning the exact arrangement — where a particular bar sits is a
 * design decision and allowed to change, while "there is something here shaped
 * like the answer" is the promise C7 makes.
 */
const blocksIn = async (element: React.ReactElement) => {
  const screen = await render(element);
  // `includeHiddenElements` is required, and that is the point: every block
  // opts out of the accessibility tree, so the default query cannot see one.
  // A skeleton that showed up here without this flag would be a skeleton
  // announcing eight rows of nothing to a screen reader.
  return screen.getAllByTestId('skeleton-block', { includeHiddenElements: true });
};

/**
 * Where a block sits in the sweep cycle, read off what it actually rendered.
 *
 * The sweep's opacity is a pure function of the block's index, so two blocks
 * that came out at different opacities are two blocks that are out of phase —
 * which is the property worth pinning. The index prop itself is not on the host
 * node to be read.
 */
const phaseOf = (block: { children: unknown[] }) => {
  const child = block.children[0] as { props: { style: Record<string, number>[] } };
  return child.props.style[1].opacity;
};

/** A style prop is an array of layers; assertions want the one flat object. */
const flattenStyle = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? style.reduce<Record<string, unknown>>((all, entry) => ({ ...all, ...flattenStyle(entry) }), {})
    : ((style as Record<string, unknown>) ?? {});

describe('skeleton frames', () => {
  it('names what is being waited for, once, for a screen reader', async () => {
    const screen = await render(<TransactionListSkeleton />);
    const frame = screen.getByTestId('transaction-list-skeleton');

    expect(frame.props.accessibilityLabel).toBe('Loading transactions');
    expect(frame.props.accessibilityRole).toBe('progressbar');
  });

  it('hides the shapes themselves — eight rows of nothing is worse than silence', async () => {
    const screen = await render(<SkeletonRows count={3} />);

    // The frame above carries the only label; nothing under it is reachable.
    expect(screen.queryAllByTestId('skeleton-block')).toHaveLength(0);

    const blocks = await blocksIn(<SkeletonRows count={3} />);
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => {
      expect(block.props.accessibilityElementsHidden).toBe(true);
      expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
    });
  });

  it('draws the rows the caller asked for, not a fixed handful', async () => {
    // A full-height feed that draws three placeholders leaves most of the frame
    // blank, which is the thing being fixed.
    const three = await blocksIn(<SkeletonRows count={3} />);
    const six = await blocksIn(<SkeletonRows count={6} />);

    expect(six).toHaveLength(three.length * 2);
  });

  it('drops the trailing figure on rows that carry none', async () => {
    const withAmount = await blocksIn(<SkeletonRow showAmount />);
    const without = await blocksIn(<SkeletonRow showAmount={false} />);

    expect(without.length).toBeLessThan(withAmount.length);
  });

  it('offsets every block so a stack does not pulse in unison', async () => {
    // Without this a stack of placeholders flashes as one panel rather than
    // reading as several things loading.
    const blocks = await blocksIn(<SkeletonRows count={2} />);
    const phases = blocks.map(phaseOf);

    expect(phases).toHaveLength(10);
    expect(new Set(phases).size).toBe(phases.length);
  });

  it('gives the second row its own slots, not a repeat of the first', async () => {
    // A row draws six blocks. A base narrower than that puts row 2's icon on
    // the same clock as row 1's amount — the unison above, one row down.
    const one = await blocksIn(<SkeletonRows count={1} />);
    const two = await blocksIn(<SkeletonRows count={2} />);

    expect(two.slice(0, one.length).map(phaseOf)).toEqual(one.map(phaseOf));
    two.slice(one.length).forEach((block) => {
      expect(one.map(phaseOf)).not.toContain(phaseOf(block));
    });
  });

  it('carries the offset across day groups rather than restarting it', async () => {
    // The feed groups by date, and `section.data.map((item, i) => ...)` would
    // hand the first row of the second day the same slot as the first row of
    // the first — the same cascade-restart C4 fixed in the list entrance.
    const blocks = await blocksIn(<TransactionListSkeleton />);
    const firstRowOfDayOne = phaseOf(blocks[2]);
    // Two heading blocks, then four rows of six, then the second day's heading.
    const firstRowOfDayTwo = phaseOf(blocks[2 + 4 * 6 + 2]);

    expect(firstRowOfDayTwo).not.toBe(firstRowOfDayOne);
  });

  it('keeps the day headings clear of the slots the rows use', async () => {
    // The headings are two blocks and a row is six, so the two counts are in
    // different units and would otherwise overlap at the top of the frame.
    const blocks = await blocksIn(<TransactionListSkeleton />);
    const headings = [phaseOf(blocks[0]), phaseOf(blocks[1])];
    const firstRow = blocks.slice(2, 8).map(phaseOf);

    headings.forEach((heading) => expect(firstRow).not.toContain(heading));
  });

  it('gives every named screen shape a labelled frame full of blocks', async () => {
    const shapes: [React.ReactElement, string][] = [
      [<TransactionListSkeleton />, 'transaction-list-skeleton'],
      [<AccountListSkeleton />, 'account-list-skeleton'],
      [<AccountDetailSkeleton />, 'account-detail-skeleton'],
      [<InsightsSkeleton />, 'insights-skeleton'],
      [<EntryDetailSkeleton />, 'entry-detail-skeleton'],
      [<HistoryDetailSkeleton label="Loading category details" />, 'history-detail-skeleton'],
    ];

    for (const [element, testID] of shapes) {
      const screen = await render(element);
      expect(screen.getByTestId(testID)).toBeTruthy();
      expect(
        screen.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length
      ).toBeGreaterThan(3);
    }
  });

  it('lets a caller label the shape it is borrowing', async () => {
    // Category Detail and Merchant History share one shape and must not share
    // one announcement.
    const category = await render(<HistoryDetailSkeleton label="Loading category details" />);
    const merchant = await render(<HistoryDetailSkeleton label="Loading merchant history" />);

    expect(category.getByTestId('history-detail-skeleton').props.accessibilityLabel).toBe(
      'Loading category details'
    );
    expect(merchant.getByTestId('history-detail-skeleton').props.accessibilityLabel).toBe(
      'Loading merchant history'
    );
  });
});

describe('error banner', () => {
  it('starts 8px high and transparent, then settles into place', async () => {
    // Two renders, per the note C6 left on this fake: `useAnimatedStyle` is
    // evaluated *during* render and returns a plain object, so a shared value
    // written by an effect only reaches the tree on the render after the one
    // that wrote it. The first frame is therefore the entrance's start and the
    // second is where it lands — which is exactly the pair worth asserting.
    const banner = () => <ErrorBanner message="Unable to load insights." />;
    const screen = await render(banner());
    const start = flattenStyle(screen.getByTestId('error-banner').props.style);

    expect(start.opacity).toBe(0);
    expect(start.transform).toEqual([{ translateY: -8 }]);

    // A fresh element, not the same one: re-rendering an identical element
    // object is a React bailout and the style read back would be stale.
    await screen.rerender(banner());
    const settled = flattenStyle(screen.getByTestId('error-banner').props.style);

    expect(settled.opacity).toBe(1);
    expect(settled.transform).toEqual([{ translateY: 0 }]);
  });

  it('announces itself as an alert', async () => {
    const screen = await render(<ErrorBanner message="Unable to load insights." />);

    expect(screen.getByTestId('error-banner').props.accessibilityRole).toBe('alert');
  });

  it('offers a retry only when there is something to retry', async () => {
    const onRetry = jest.fn();
    const withRetry = await render(<ErrorBanner message="Nope." onRetry={onRetry} />);
    expect(withRetry.getByText('Retry')).toBeTruthy();

    const without = await render(<ErrorBanner message="Nope." />);
    expect(without.queryByText('Retry')).toBeNull();
  });

  it('puts the raw error through the one friendly-message translator', async () => {
    // Every call site used to do this itself, or forget to.
    const screen = await render(<ErrorBanner message="Network request failed" />);

    expect(screen.queryByText('Network request failed')).toBeNull();
  });

  it('takes its entrance from the motion vocabulary rather than a literal', () => {
    // A banner is a card, and a card is 220ms. A hand-tuned number here is
    // exactly what C1's tokens exist to prevent.
    expect(Motion.duration.base).toBe(220);
  });
});

describe('with reduced motion on', () => {
  // The setup file's Reanimated fake answers `false`; this reaches through it
  // rather than restating the whole fake, which is what the components under
  // test are actually built on.
  const reanimated = require('react-native-reanimated');
  let reducedMotion: jest.SpyInstance;

  beforeEach(() => {
    reducedMotion = jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(true);
  });

  afterEach(() => reducedMotion.mockRestore());

  it('holds the placeholder still rather than removing it', async () => {
    // A skeleton is a *shape*, and the shape is the part that earns its place.
    // Reduced motion turns the sweep off; it does not go back to a spinner or
    // to a blank frame.
    const blocks = await blocksIn(<SkeletonRows count={3} />);

    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => expect(phaseOf(block)).toBe(0));
  });

  it('still lands the banner in place, just without the travel', async () => {
    // Per C1's rule the degrade is the same animation with its duration zeroed,
    // so the end state has to be identical — a banner left at -8px and
    // transparent is the degrade eating the content rather than the motion.
    const banner = () => <ErrorBanner message="Unable to load insights." />;
    const screen = await render(banner());
    await screen.rerender(banner());
    const style = flattenStyle(screen.getByTestId('error-banner').props.style);

    expect(style.opacity).toBe(1);
    expect(style.transform).toEqual([{ translateY: 0 }]);
  });
});

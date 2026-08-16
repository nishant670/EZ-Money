import { View } from 'react-native';

import { Shimmer } from '@/components/ui/Shimmer';
import {
  ROW_BLOCKS,
  SkeletonCard,
  SkeletonFrame,
  SkeletonRows,
  SkeletonStat,
  lineWidth,
} from '@/components/ui/Skeleton';

/**
 * What the transaction feed is about to look like: two day headings with their
 * running total, and rows under each.
 *
 * The headings matter more than they look. The feed's rows are grouped by date
 * and the group heading is the tallest single jump the layout makes when data
 * lands — a skeleton of rows alone would settle correctly and *then* have every
 * row pushed down by a heading it did not account for.
 */

/** Rows per day. Two days of four fills a handset screen without overrunning it. */
const DAY_SHAPE = [4, 3] as const;

const TOTAL_ROWS = DAY_SHAPE.reduce((total, rows) => total + rows, 0);

/**
 * The headings take their sweep slots from past the end of the rows'.
 *
 * A heading is two blocks and a row is `ROW_BLOCKS`, so the two counts are in
 * different units and cannot be interleaved by accident — starting the headings
 * at 0 alongside the rows is how a day label ends up pulsing in time with the
 * icon of the row beneath it.
 */
const HEADING_BAND = TOTAL_ROWS * ROW_BLOCKS;

export function TransactionListSkeleton() {
  return (
    <SkeletonFrame label="Loading transactions" testID="transaction-list-skeleton">
      {DAY_SHAPE.map((rows, day) => (
        <View key={day} className="mb-6">
          <View className="mb-3 flex-row items-center justify-between px-6">
            <Shimmer width={92} height={10} index={HEADING_BAND + day * 2} />
            <Shimmer width={62} height={20} radius={8} index={HEADING_BAND + day * 2 + 1} />
          </View>
          <View className="px-6">
            <SkeletonRows
              count={rows}
              startIndex={DAY_SHAPE.slice(0, day).reduce((total, count) => total + count, 0)}
            />
          </View>
        </View>
      ))}
    </SkeletonFrame>
  );
}

/**
 * Category Detail and Merchant History, which are the same screen twice: a
 * centred hero, two metric cards, a search field, and then the feed.
 *
 * They share one shape because they share one layout — the alternative was two
 * near-identical placeholders that would each have to be remembered whenever
 * either screen moved a card.
 */
export function HistoryDetailSkeleton({ label }: { label: string }) {
  return (
    <SkeletonFrame label={label} testID="history-detail-skeleton">
      <View className="items-center px-5 py-8">
        <Shimmer width={96} height={96} radius={32} index={0} />
        <Shimmer width={220} height={30} radius={10} index={1} style={{ marginTop: 24 }} />
        <Shimmer width={168} height={44} radius={22} index={2} style={{ marginTop: 20 }} />
      </View>

      <View className="mx-5 mb-7 flex-row gap-3">
        {[0, 1].map((metric) => (
          <SkeletonCard key={metric} radius={24} padding={16} style={{ flex: 1 }}>
            <SkeletonStat index={metric + 2} />
          </SkeletonCard>
        ))}
      </View>

      {/* The search field is real on the screen this replaces, so it is drawn
          at its own height rather than as a row of text lines. */}
      <Shimmer height={62} radius={24} index={7} style={{ marginHorizontal: 20, marginBottom: 28 }} />

      <View className="px-5">
        <SkeletonRows count={4} startIndex={2} />
      </View>
    </SkeletonFrame>
  );
}

/**
 * One transaction opened up: the hero — icon, amount, title — and the details
 * card of labelled rows under it.
 *
 * This screen is reached by tapping a row that is already on screen, so the
 * wait is short and the shape is mostly what makes it bearable: the amount the
 * user just tapped lands exactly where the placeholder held it.
 */
export function EntryDetailSkeleton() {
  return (
    <SkeletonFrame
      label="Loading transaction"
      testID="entry-detail-skeleton"
      style={{ padding: 24 }}>
      <View className="mb-10 items-center">
        <Shimmer width={112} height={112} radius={32} index={0} />
        <Shimmer width={180} height={36} radius={10} index={1} style={{ marginTop: 24 }} />
        <Shimmer width={148} height={18} radius={8} index={2} style={{ marginTop: 12 }} />
      </View>

      <SkeletonCard radius={40} padding={32}>
        {[0, 1, 2].map((row) => (
          <View
            key={row}
            style={{ flexDirection: 'row', gap: 20, marginBottom: row === 2 ? 0 : 32 }}>
            <Shimmer width={48} height={48} radius={24} index={3 + row * 3} />
            <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
              <Shimmer width="38%" height={9} index={4 + row * 3} />
              <Shimmer width={lineWidth(row)} height={14} index={5 + row * 3} />
            </View>
          </View>
        ))}
      </SkeletonCard>
    </SkeletonFrame>
  );
}

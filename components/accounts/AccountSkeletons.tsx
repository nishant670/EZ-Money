import { View } from 'react-native';

import { Shimmer } from '@/components/ui/Shimmer';
import { SkeletonCard, SkeletonFrame, SkeletonRows, SkeletonStat } from '@/components/ui/Skeleton';

/**
 * The two account-shaped waits: the list of payment sources, and one of them
 * opened up.
 *
 * Both are drawn from the screens they stand in for rather than from a generic
 * card stack, because both screens are unusually top-heavy — the list rows
 * carry three lines and a badge strip, and the detail screen opens with a
 * centred hero that is most of the first viewport. A generic placeholder would
 * settle at the wrong height on the one screen where the wrong height is most
 * of what you can see.
 */

/**
 * Sits inside the panel's own scroll container, which already owns the screen
 * padding — the skeleton draws rows and nothing else, so it cannot disagree
 * with the list it replaces about where the left edge is.
 */
export function AccountListSkeleton() {
  return (
    <SkeletonFrame label="Loading accounts" testID="account-list-skeleton">
      <SkeletonRows count={4} lines={3} />
    </SkeletonFrame>
  );
}

export function AccountDetailSkeleton() {
  return (
    <SkeletonFrame
      label="Loading account"
      testID="account-detail-skeleton"
      style={{ paddingHorizontal: 30 }}>
      {/* The hero: icon, name, identifier, then the headline figure. */}
      <SkeletonCard radius={34} padding={20} style={{ alignItems: 'center', paddingVertical: 36 }}>
        <Shimmer width={68} height={68} radius={34} index={0} />
        <Shimmer width={148} height={20} radius={8} index={1} style={{ marginTop: 20 }} />
        <Shimmer width={104} height={12} index={2} style={{ marginTop: 10 }} />
        <Shimmer width={86} height={10} index={3} style={{ marginTop: 24 }} />
        <Shimmer width={188} height={38} radius={10} index={4} style={{ marginTop: 10 }} />
        <Shimmer width={130} height={10} index={5} style={{ marginTop: 10 }} />
      </SkeletonCard>

      {/* The three action buttons under it, which are a fixed height whatever
          the account turns out to be. */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
        {[0, 1, 2].map((action) => (
          <Shimmer key={action} height={64} radius={22} index={6 + action} style={{ flex: 1 }} />
        ))}
      </View>

      <SkeletonCard radius={26} padding={20} style={{ marginTop: 28 }}>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <SkeletonStat index={5} />
          <SkeletonStat index={6} />
        </View>
      </SkeletonCard>

      <Shimmer width={150} height={18} radius={8} index={12} style={{ marginTop: 36 }} />
      <View style={{ marginTop: 16 }}>
        <SkeletonRows count={3} variant="list" carded={false} startIndex={4} />
      </View>
    </SkeletonFrame>
  );
}

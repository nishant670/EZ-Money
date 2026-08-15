import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, type LayoutRectangle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { haptics } from '@/lib/haptics';

export const MONEY_SEGMENTS = ['upcoming', 'budgets', 'subscriptions', 'accounts'] as const;

export type MoneySegment = (typeof MONEY_SEGMENTS)[number];

export const isMoneySegment = (value: unknown): value is MoneySegment =>
  typeof value === 'string' && (MONEY_SEGMENTS as readonly string[]).includes(value);

export const moneySegmentMeta: Record<
  MoneySegment,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  upcoming: { label: 'Upcoming', icon: 'calendar-clock' },
  budgets: { label: 'Budgets', icon: 'chart-donut' },
  subscriptions: { label: 'Subscriptions', icon: 'calendar-sync-outline' },
  accounts: { label: 'Accounts', icon: 'wallet-outline' },
};

type MoneySegmentsProps = {
  active: MoneySegment;
  onChange: (segment: MoneySegment) => void;
};

/**
 * Scrolls rather than squeezes.
 *
 * Four labels in a fixed four-up segmented control puts "Subscriptions" at
 * about seven characters of readable width on a 360dp phone, which is how you
 * end up with "Subs". A scrolling row keeps every label whole and matches the
 * account filter chips one segment along.
 */
export function MoneySegments({ active, onChange }: MoneySegmentsProps) {
  const theme = useThemeTokens().colors;
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Partial<Record<MoneySegment, LayoutRectangle>>>({});

  /**
   * A deep link can land on the last segment — `/money?segment=accounts` from
   * the entry screen does — and the row does not scroll itself, so the pill
   * that says where you are sat half off the right edge.
   *
   * Each pill reports its own box, because they are different widths and a
   * fixed offset per index would be wrong the first time a label changes. The
   * scroll is driven from both sides: this effect covers a segment change
   * after layout, and `onLayout` covers the deep link, where the active
   * segment is already set on the first render and its box does not exist yet
   * when the effect runs.
   */
  const scrollSegmentIntoView = (segment: MoneySegment, animated: boolean) => {
    const box = layouts.current[segment];
    if (!box) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, box.x - 22), animated });
  };

  useEffect(() => {
    scrollSegmentIntoView(active, true);
  }, [active]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // A horizontal ScrollView is still a flex child of the column above it,
      // and without this it grows to fill the screen and pins the active panel
      // to the bottom edge. It only looks right in the account filter row one
      // segment along because that one sits *inside* a vertical scroll view,
      // whose content sizes to itself.
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingBottom: 14 }}>
      {MONEY_SEGMENTS.map((segment) => {
        const meta = moneySegmentMeta[segment];
        const selected = segment === active;

        return (
          <Pressable
            key={segment}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={meta.label}
            onPress={() => {
              haptics.select();
              onChange(segment);
            }}
            onLayout={(event) => {
              layouts.current[segment] = event.nativeEvent.layout;
              // First layout after a deep link: the effect above has already
              // run with nothing to measure. No animation — the row should
              // arrive in the right place, not slide there.
              if (segment === active) scrollSegmentIntoView(segment, false);
            }}
            className="h-11 flex-row items-center gap-2 rounded-full border px-4"
            style={{
              borderColor: selected ? theme.accent : theme.border,
              backgroundColor: selected ? theme.secondary : theme.card,
            }}>
            <MaterialCommunityIcons
              name={meta.icon}
              size={16}
              color={selected ? theme.accent : 'rgba(120,120,120,0.95)'}
            />
            <ThemedText
              className="text-sm"
              style={{
                color: selected ? theme.accent : theme.text,
                fontFamily: Fonts.title,
              }}>
              {meta.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

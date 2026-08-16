import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useScrollToTop } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { MoneySegment } from '@/components/money/MoneySegments';
import { PanelActionRow } from '@/components/money/PanelActionRow';
import { ThemedText } from '@/components/themed-text';
import { StateView } from '@/components/ui/StateView';
import { Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fetchAccounts, type Account } from '@/lib/accounts';
import { formatMoney } from '@/lib/money';
import { fetchSubscriptions, type Subscription } from '@/lib/subscriptions';
import {
  buildUpcomingDues,
  formatDueLabel,
  totalUpcomingAmount,
  type UpcomingDue,
} from '@/lib/upcoming';

const HORIZON_DAYS = 30;

type UpcomingPanelProps = {
  onSelectSegment: (segment: MoneySegment) => void;
};

/**
 * One list of everything with a date on it.
 *
 * A renewal was only visible on Subscriptions and a card statement only on
 * Accounts, so "what leaves my account this week" was a question the app held
 * both halves of and answered neither. The merge is in `lib/upcoming.ts` and
 * takes `today` as an argument, which is why it can be tested.
 */
export function UpcomingPanel({ onSelectSegment }: UpcomingPanelProps) {
  const router = useRouter();
  const theme = useThemeTokens();
  const colors = theme.colors;
  const muted = `${colors.text}99`;
  const { token } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setSubscriptions([]);
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Either source failing should not blank the other — a card due date is
    // still worth showing when the subscriptions call times out.
    const [loadedSubscriptions, loadedAccounts] = await Promise.all([
      fetchSubscriptions(token).catch(() => [] as Subscription[]),
      fetchAccounts(token).catch(() => [] as Account[]),
    ]);
    setSubscriptions(loadedSubscriptions);
    setAccounts(loadedAccounts);
    setLoading(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const dues = useMemo(
    () => buildUpcomingDues({ subscriptions, accounts, horizonDays: HORIZON_DAYS }),
    [subscriptions, accounts]
  );

  const overdue = useMemo(() => dues.filter((due) => due.state === 'overdue'), [dues]);
  const thisWeek = useMemo(
    () => dues.filter((due) => due.state === 'today' || due.state === 'soon'),
    [dues]
  );
  const later = useMemo(() => dues.filter((due) => due.state === 'scheduled'), [dues]);
  const total = useMemo(() => totalUpcomingAmount(dues), [dues]);

  const openDue = (due: UpcomingDue) => {
    if (due.kind === 'card') {
      router.push({ pathname: '/accounts/[id]', params: { id: String(due.sourceID) } });
      return;
    }
    onSelectSegment('subscriptions');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <PanelActionRow
        subtitle={
          loading
            ? 'Checking renewals and card due dates'
            : dues.length === 0
              ? `Nothing due in the next ${HORIZON_DAYS} days`
              : `${formatMoney(total)} across ${dues.length} payment${dues.length === 1 ? '' : 's'}`
        }
        colors={colors}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 120,
          gap: 20,
        }}>
        {!loading && dues.length === 0 ? (
          <StateView
            icon="calendar-check"
            title="Nothing due yet"
            message="Renewals and credit card due dates land here once Finnri knows about them. Add a subscription or a due date to a card and this fills itself in."
            actionLabel="Add a subscription"
            onAction={() => onSelectSegment('subscriptions')}
          />
        ) : (
          <>
            <DueGroup
              title="Overdue"
              tone="#DC2626"
              dues={overdue}
              muted={muted}
              onPress={openDue}
            />
            <DueGroup
              title="Next 7 days"
              tone={colors.accent}
              dues={thisWeek}
              muted={muted}
              onPress={openDue}
            />
            <DueGroup
              title={`Rest of the next ${HORIZON_DAYS} days`}
              tone="#64748B"
              dues={later}
              muted={muted}
              onPress={openDue}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

type DueGroupProps = {
  title: string;
  tone: string;
  dues: UpcomingDue[];
  muted: string;
  onPress: (due: UpcomingDue) => void;
};

function DueGroup({ title, tone, dues, muted, onPress }: DueGroupProps) {
  const colors = useThemeTokens().colors;
  if (dues.length === 0) return null;

  return (
    <View className="gap-3">
      <ThemedText
        className="text-xs uppercase"
        style={{ fontFamily: Fonts.title, color: tone, letterSpacing: 0.8 }}>
        {title}
      </ThemedText>
      <View className="gap-3">
        {dues.map((due) => (
          <Pressable
            key={due.key}
            accessibilityRole="button"
            accessibilityLabel={`${due.title}, ${formatDueLabel(due)}`}
            onPress={() => onPress(due)}
            className="min-h-[72px] flex-row items-center rounded-[26px] px-4 py-4"
            style={{ backgroundColor: colors.card }}>
            <View
              className="mr-4 h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: `${tone}1F` }}>
              <MaterialCommunityIcons
                name={due.kind === 'card' ? 'credit-card-clock-outline' : 'calendar-sync-outline'}
                size={21}
                color={tone}
              />
            </View>
            <View className="min-w-0 flex-1 pr-3">
              <ThemedText
                numberOfLines={1}
                className="text-base"
                style={{ fontFamily: Fonts.title, color: colors.text }}>
                {due.title}
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                className="mt-1 text-xs"
                style={{ fontFamily: Fonts.body, color: muted }}>
                {due.subtitle}
              </ThemedText>
            </View>
            <View className="items-end">
              <ThemedText
                numberOfLines={1}
                className="text-base"
                style={{ fontFamily: Fonts.title, color: colors.text }}>
                {due.amount === null ? '—' : formatMoney(due.amount)}
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                className="mt-1 text-[11px]"
                style={{ fontFamily: Fonts.body, color: tone }}>
                {formatDueLabel(due)}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

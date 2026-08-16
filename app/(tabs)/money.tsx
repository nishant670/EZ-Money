import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountsPanel } from '@/components/money/AccountsPanel';
import { BudgetsPanel } from '@/components/money/BudgetsPanel';
import {
  MoneySegments,
  isMoneySegment,
  type MoneySegment,
} from '@/components/money/MoneySegments';
import { SubscriptionsPanel } from '@/components/money/SubscriptionsPanel';
import { UpcomingPanel } from '@/components/money/UpcomingPanel';
import { AppHeader } from '@/components/navigation/AppHeader';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const toParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Everything that decides where money goes, in one tab.
 *
 * Budgets, Subscriptions and the calculators used to live behind Profile,
 * three taps inside a settings drawer alongside logout — the paid features
 * filed under housekeeping. Accounts, meanwhile, held a permanent slot in the
 * bottom bar and is the one screen you finish setting up and stop opening.
 * They have swapped places.
 *
 * Only the active segment mounts. Each panel fetches on focus and would
 * otherwise fire four loads on every visit to the tab.
 */
export default function MoneyScreen() {
  const router = useRouter();
  const colors = useThemeTokens().colors;
  const params = useLocalSearchParams();
  const requestedSegment = toParam(params.segment);

  const [segment, setSegment] = useState<MoneySegment>(
    isMoneySegment(requestedSegment) ? requestedSegment : 'upcoming'
  );

  // A push from elsewhere — "Manage accounts" on the entry screen — lands on
  // this tab with a segment in the query rather than remounting the screen, so
  // the param has to be watched and not only read once.
  useEffect(() => {
    if (isMoneySegment(requestedSegment)) setSegment(requestedSegment);
  }, [requestedSegment]);

  return (
    <SafeAreaView
      className="flex-1"
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Money"
        rightIcon="calculator-variant-outline"
        onRightPress={() => router.push('/tools')}
      />

      <MoneySegments active={segment} onChange={setSegment} />

      {segment === 'upcoming' && <UpcomingPanel onSelectSegment={setSegment} />}
      {segment === 'budgets' && <BudgetsPanel embedded />}
      {segment === 'subscriptions' && <SubscriptionsPanel embedded />}
      {segment === 'accounts' && <AccountsPanel />}
    </SafeAreaView>
  );
}

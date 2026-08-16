import { SafeAreaView } from 'react-native-safe-area-context';

import { SubscriptionsPanel } from '@/components/money/SubscriptionsPanel';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * The standalone route, kept because the recurring review deep-links here with
 * a candidate to convert (`?source=recurring_review&merchant=…`). The Money
 * tab renders the same panel embedded.
 */
export default function SubscriptionsScreen() {
  const colors = useThemeTokens().colors;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <SubscriptionsPanel />
    </SafeAreaView>
  );
}

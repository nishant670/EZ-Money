import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetsPanel } from '@/components/money/BudgetsPanel';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * The standalone route, kept because Insights, the weekly review and the entry
 * screen deep-link here with prefill params (`?source=insight&category=…`).
 * The Money tab renders the same panel embedded; this is the same screen with
 * a back arrow.
 */
export default function BudgetsScreen() {
  const colors = useThemeTokens().colors;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <BudgetsPanel />
    </SafeAreaView>
  );
}

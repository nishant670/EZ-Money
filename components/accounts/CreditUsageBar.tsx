import { cssInterop } from 'nativewind';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { CreditUsage } from '@/lib/account-display';

const TText = cssInterop(ThemedText, { className: 'style' });

/**
 * How much of a card's limit is in use — "₹23,500 of ₹2,00,000 used" over a bar.
 *
 * This is the only place the credit limit is allowed to appear, and it appears
 * as a denominator. The audit found the bare limit rendered where a balance
 * would be, so the card read as two lakh the user had rather than two lakh they
 * could borrow.
 *
 * The bar is clamped to its track; the percentage next to it is not, so a card
 * over its limit says so instead of quietly sitting at 100%.
 */
export function CreditUsageBar({
  usage,
  trackColor,
}: {
  usage: CreditUsage;
  trackColor: string;
}) {
  const theme = useThemeTokens().colors;
  const overLimit = usage.percent > 100;
  const nearLimit = usage.percent >= 80;
  const fillColor = overLimit ? '#EF4444' : nearLimit ? '#F97316' : theme.accent;

  return (
    <View className="mt-4">
      <View className="flex-row items-center justify-between gap-3">
        <TText
          className="min-w-0 flex-1 text-xs"
          numberOfLines={1}
          style={{ fontFamily: Fonts.body, color: '#64748B' }}>
          {usage.label}
        </TText>
        <TText
          className="text-xs"
          numberOfLines={1}
          style={{ fontFamily: Fonts.title, color: overLimit ? '#EF4444' : '#64748B' }}>
          {Math.round(usage.percent)}%
        </TText>
      </View>
      <View
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: trackColor }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(usage.percent) }}
        accessibilityLabel={usage.label}>
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(usage.percent, usage.percent > 0 ? 3 : 0))}%`,
            backgroundColor: fillColor,
          }}
        />
      </View>
    </View>
  );
}

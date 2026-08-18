import { cssInterop } from 'nativewind';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { CardLimitSummary } from '@/lib/accounts';
import { formatMoney } from '@/lib/money';

const TText = cssInterop(ThemedText, { className: 'style' });

const SIZE = 188;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * What a card has left to spend.
 *
 * This is the one number people open a card screen for, so it is the only one
 * given the headline. Everything else on the card — the bill, the due date —
 * is the action underneath it.
 *
 * The ring carries two arcs rather than a row of four statistics: what is
 * outstanding, and what EMI plans have blocked. They are genuinely different
 * kinds of unavailable — outstanding is money owed now, blocked principal is
 * limit the issuer is holding against instalments not yet billed — and a user
 * who cannot spend up to their limit deserves to see which of the two is in
 * the way.
 *
 * `credit_limit` never appears as a figure of its own. It is the denominator
 * of "of ₹X", and nothing else.
 */
export function CardLimitRing({ limit }: { limit: CardLimitSummary }) {
  const theme = useThemeTokens().colors;

  const creditLimit = limit.credit_limit;
  const hasLimit = creditLimit > 0 && typeof limit.available_limit === 'number';

  // Without a limit there is nothing to draw a ring against. The outstanding
  // figure is still real and still worth showing, so it takes the headline
  // instead of an invented denominator.
  if (!hasLimit) {
    return (
      <View className="mt-6 items-center">
        <TText
          className="text-xs uppercase"
          style={{ fontFamily: Fonts.title, color: '#8EA0B8', letterSpacing: 1.4 }}>
          Outstanding
        </TText>
        <TText
          className="mt-2 text-[38px]"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: Fonts.title, color: theme.text }}>
          {formatMoney(limit.outstanding)}
        </TText>
        <TText
          className="mt-2 text-xs"
          style={{ fontFamily: Fonts.body, color: '#8EA0B8' }}>
          Add a credit limit to track how much is free
        </TText>
      </View>
    );
  }

  const available = limit.available_limit ?? 0;
  const outstanding = Math.max(0, limit.outstanding);
  const blocked = Math.max(0, limit.emi_blocked_principal);

  // Arc lengths are fractions of the limit, clamped so an over-limit card
  // fills the ring rather than wrapping past its own start.
  const outstandingFraction = Math.min(1, outstanding / creditLimit);
  const blockedFraction = Math.min(1 - outstandingFraction, blocked / creditLimit);

  const utilisation = limit.utilisation_pct ?? 0;
  const overLimit = utilisation > 100;
  const nearLimit = utilisation >= 80;
  const outstandingColor = overLimit ? '#EF4444' : nearLimit ? '#F97316' : theme.accent;
  const blockedColor = '#8B5CF6';

  return (
    <View className="mt-6 items-center">
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* Track: the whole limit. */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={theme.secondary}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Blocked principal sits after the outstanding arc, so the two read
              as one continuous "spoken for" span. */}
          {blockedFraction > 0 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={blockedColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - (outstandingFraction + blockedFraction))}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
          {outstandingFraction > 0 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={outstandingColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - outstandingFraction)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </Svg>

        <View className="absolute inset-0 items-center justify-center px-6">
          <TText
            className="text-[11px] uppercase"
            style={{ fontFamily: Fonts.title, color: '#8EA0B8', letterSpacing: 1.2 }}>
            Available
          </TText>
          <TText
            className="mt-1 text-[30px]"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: Fonts.title,
              color: available < 0 ? '#EF4444' : theme.text,
            }}>
            {formatMoney(available)}
          </TText>
          <TText
            className="mt-1 text-[11px]"
            numberOfLines={1}
            style={{ fontFamily: Fonts.body, color: '#8EA0B8' }}>
            of {formatMoney(creditLimit)}
          </TText>
        </View>
      </View>

      <View className="mt-5 flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <LimitLegend color={outstandingColor} label="Outstanding" amount={outstanding} />
        {blocked > 0 && <LimitLegend color={blockedColor} label="On EMI" amount={blocked} />}
      </View>

      {overLimit && (
        <TText
          className="mt-3 text-xs"
          style={{ fontFamily: Fonts.title, color: '#EF4444' }}>
          {Math.round(utilisation)}% of your limit used
        </TText>
      )}

      {/* A card with no bill yet is reporting what Finnri happens to know,
          which is only as complete as what the user has logged. Saying so is
          the difference between an estimate and a claim. */}
      {limit.outstanding_source === 'ledger' && (
        <TText
          className="mt-3 px-6 text-center text-[11px]"
          style={{ fontFamily: Fonts.body, color: '#8EA0B8' }}>
          Based on your tracked transactions. Add a statement for the exact figure.
        </TText>
      )}
    </View>
  );
}

function LimitLegend({
  color,
  label,
  amount,
}: {
  color: string;
  label: string;
  amount: number;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <TText className="text-xs" style={{ fontFamily: Fonts.body, color: '#7C8EA8' }}>
        {label}
      </TText>
      <TText className="text-xs" style={{ fontFamily: Fonts.title, color: theme.text }}>
        {formatMoney(amount)}
      </TText>
    </View>
  );
}

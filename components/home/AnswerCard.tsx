import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotion } from '@/hooks/use-motion';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import type { LedgerAnswer } from '@/lib/parse';
import { openAnswerTransactions } from '@/lib/transaction-links';

/**
 * The answer to a question asked through the capture field.
 *
 * Everything numeric on this card came out of the database and travelled here
 * as a number. The server sends figures and labels; the sentence around them is
 * assembled below, and every amount goes through `formatMoney` like every other
 * amount in the app. Nothing here was written by the model.
 *
 * The card always states its own scope. "₹4,820" alone is unfalsifiable — the
 * reader cannot tell whether it covers this month, last month or everything, so
 * they cannot tell whether it is wrong. The subject and the period sit directly
 * under the number, and the row beneath opens the transactions the number was
 * computed from, so the answer is always one tap from its own evidence.
 */

type AnswerCardProps = {
  answer: LedgerAnswer;
  /** What the user actually said, shown back so a misheard word is visible. */
  sourceText: string;
  onDismiss: () => void;
  /** Re-asks one of the suggested questions through the same channel. */
  onAskSuggestion: (question: string) => void;
};

const metricLabels: Record<string, string> = {
  spend_total: 'Spent',
  income_total: 'Received',
  net: 'Net',
  count: 'Transactions',
  average: 'Average',
  largest: 'Largest',
  breakdown: 'Spent',
};

/** The line under the number: what was counted, over which window. */
export const describeAnswerScope = (answer: LedgerAnswer) => {
  const parts: string[] = [];
  if (answer.subject) parts.push(answer.subject);
  else if (answer.metric === 'income_total') parts.push('across all income');
  else if (answer.metric === 'net') parts.push('income minus spending');
  if (answer.period.label) parts.push(answer.period.label);
  return parts.join(' · ');
};

export const describeAnswerCount = (answer: LedgerAnswer) => {
  if (answer.metric === 'count') return null;
  if (answer.transaction_count === 1) return 'from 1 transaction';
  return `from ${answer.transaction_count} transactions`;
};

export function AnswerCard({ answer, sourceText, onDismiss, onAskSuggestion }: AnswerCardProps) {
  const themeTokens = useThemeTokens();
  const colors = themeTokens.colors;
  const motion = useMotion();
  const muted = `${colors.text}99`;
  const isDark = themeTokens.mode === 'dark';

  const enter = motion.reduced ? undefined : FadeIn.duration(motion.duration('base'));
  const exit = motion.reduced ? undefined : FadeOut.duration(motion.exitDuration('instant'));

  const scope = describeAnswerScope(answer);
  const countLine = describeAnswerCount(answer);
  const canOpenList =
    answer.status === 'answered' && Object.keys(answer.filters ?? {}).length > 0;

  const openList = () => {
    haptics.select();
    openAnswerTransactions(answer.filters);
  };

  return (
    <Animated.View
      entering={enter}
      exiting={exit}
      className="mx-6 mb-4 rounded-3xl border p-4"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF8F4',
        borderColor: colors.border,
      }}>
      <View className="flex-row items-start gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.secondary }}>
          <MaterialCommunityIcons name="creation" size={18} color={colors.accent} />
        </View>

        <View className="min-w-0 flex-1">
          {/* The question, as Finnri heard it. A wrong answer is usually a
              misheard word, and this is the only place that shows. */}
          {sourceText ? (
            <ThemedText variant="caption" style={{ color: muted }} numberOfLines={2}>
              “{sourceText}”
            </ThemedText>
          ) : null}

          {answer.status === 'unsupported' || answer.status === 'no_data' ? (
            <ThemedText variant="bodyStrong" style={{ marginTop: 6, color: colors.text }}>
              {answer.status === 'unsupported'
                ? (answer.message ?? 'Finnri cannot answer that one yet.')
                : `Nothing recorded${scope ? ` for ${scope}` : ''}.`}
            </ThemedText>
          ) : (
            <>
              <ThemedText
                variant="micro"
                style={{ marginTop: 8, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                {metricLabels[answer.metric] ?? 'Answer'}
              </ThemedText>
              {/* amountHero carries its own line height. A bare text-[Npx]
                  would clip the comma out of ₹40,486. */}
              <ThemedText variant="amountHero" style={{ marginTop: 2, color: colors.text }}>
                {answer.metric === 'count'
                  ? String(answer.transaction_count)
                  : formatMoney(answer.amount ?? 0)}
              </ThemedText>
              {scope ? (
                <ThemedText variant="caption" style={{ marginTop: 4, color: muted }}>
                  {scope}
                  {countLine ? ` · ${countLine}` : ''}
                </ThemedText>
              ) : null}

              {answer.largest_entry ? (
                <ThemedText variant="caption" style={{ marginTop: 6, color: muted }}>
                  {answer.largest_entry.title || answer.largest_entry.merchant || 'Transaction'} ·{' '}
                  {answer.largest_entry.date}
                </ThemedText>
              ) : null}

              {answer.breakdown.length > 0 ? (
                <View className="mt-3 gap-2">
                  {answer.breakdown.map((slice) => (
                    <View key={slice.label} className="flex-row items-center justify-between gap-3">
                      <ThemedText
                        variant="caption"
                        numberOfLines={1}
                        style={{ flex: 1, color: colors.text }}>
                        {slice.label}
                      </ThemedText>
                      <ThemedText variant="captionStrong" style={{ color: colors.text }}>
                        {formatMoney(slice.amount)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}

          {/* Questions Finnri can answer, offered wherever it could not answer
              this one — a decline that names no alternative teaches people to
              stop asking. */}
          {answer.status !== 'answered' && answer.suggestions.length > 0 ? (
            <View className="mt-3 gap-2">
              {answer.suggestions.slice(0, 3).map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => {
                    haptics.select();
                    onAskSuggestion(suggestion);
                  }}
                  className="self-start rounded-full border px-3 py-2"
                  style={{ borderColor: colors.border }}>
                  <ThemedText variant="caption" style={{ color: colors.accent }}>
                    {suggestion}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {canOpenList ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See the ${answer.transaction_count} transactions behind this`}
              onPress={openList}
              className="mt-3 self-start rounded-full px-4 py-2"
              style={{ backgroundColor: colors.accent }}>
              <ThemedText variant="button" style={{ color: '#FFFFFF' }}>
                {answer.transaction_count === 1
                  ? 'See the transaction'
                  : `See the ${answer.transaction_count} transactions`}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss answer"
          hitSlop={12}
          onPress={() => {
            haptics.select();
            onDismiss();
          }}>
          <MaterialCommunityIcons name="close" size={18} color={muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

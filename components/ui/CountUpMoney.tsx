import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useCountUp } from '@/hooks/use-reveal';
import { formatMoney, type FormatMoneyOptions } from '@/lib/money';

/**
 * An amount that arrives rather than appears.
 *
 * The figures on Insights are the screen's whole claim — what came in, what
 * went out, what is left — and they used to land in the same frame as the card
 * around them, indistinguishable from the ones the previous period had put
 * there. Counting them up is what marks them as *this* period's answer, and it
 * takes the eye to the number without anything having to point at it.
 *
 * It is a leaf on purpose. The count is a JS-thread re-render per frame (see
 * `hooks/use-reveal.ts` for why it has to be), so it is confined to the one
 * `Text` that changes and never re-renders the card holding it.
 *
 * Only for a number the screen is *presenting*. A figure that answers a
 * touch — the amount under a tapped bar — must not count up: the user asked a
 * question and is owed the answer, not a performance of it.
 */
export function CountUpMoney({
  amount,
  sign,
  ...rest
}: ThemedTextProps & {
  amount: number;
  sign?: FormatMoneyOptions['sign'];
}) {
  const shown = useCountUp(amount);

  return <ThemedText {...rest}>{formatMoney(shown, { sign })}</ThemedText>;
}

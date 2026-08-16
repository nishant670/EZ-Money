import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { haptics } from '@/lib/haptics';
import { formatAmountEntry } from '@/lib/money';

export type AmountKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'delete';

/** ₹99,99,99,999 is the ceiling. Past that the field is a typo, not an amount. */
const MAX_RUPEE_DIGITS = 9;
const MAX_PAISE_DIGITS = 2;

const KEY_ROWS: AmountKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'delete'],
];

const KEY_HEIGHT = 54;

/**
 * One keystroke against the raw amount string.
 *
 * The value edited here is the same plain string the form saves — grouping
 * and the ₹ live in {@link formatAmountEntry}, never in state, so the digits
 * that reach `Number()` are the digits that were typed.
 */
export const appendAmountKey = (current: string, key: AmountKey): string => {
  const value = current ?? '';
  if (key === 'delete') {
    return value.slice(0, -1);
  }
  if (key === '.') {
    if (value.includes('.')) {
      return value;
    }
    return value === '' ? '0.' : `${value}.`;
  }

  const pointIndex = value.indexOf('.');
  if (pointIndex !== -1) {
    return value.length - pointIndex - 1 >= MAX_PAISE_DIGITS ? value : `${value}${key}`;
  }
  // A lone leading zero is a placeholder, not a digit: 0 then 5 is 5, not 05.
  if (value === '0') {
    return key;
  }
  return value.length >= MAX_RUPEE_DIGITS ? value : `${value}${key}`;
};

/** True once the string holds an amount worth saving. */
export const hasEnteredAmount = (value: string) => Number(value || 0) > 0;

const CARET_BLINK_MS = 560;

/**
 * The amount under the caret. Full width, and the only thing on the screen
 * with this much weight — it is what the sheet exists to collect.
 *
 * Rendered only while the keypad is up, so the caret is unconditional: it is
 * the affordance standing in for the missing system keyboard, saying where
 * the next digit lands.
 */
export function AmountDisplay({ value }: { value: string }) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const reducedMotion = useReducedMotion();
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const isEmpty = value.trim().length === 0;

  useEffect(() => {
    if (reducedMotion) {
      // A caret that never stops moving is exactly what this setting is for.
      caretOpacity.setValue(1);
      return;
    }
    caretOpacity.setValue(1);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: CARET_BLINK_MS,
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: CARET_BLINK_MS,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [caretOpacity, reducedMotion]);

  return (
    <View
      testID="entry-amount-display"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Amount ${formatAmountEntry(value)}`}
      className="w-full flex-row items-center justify-center py-2">
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        className="font-black"
        style={{
          fontSize: 46,
          lineHeight: 56,
          color: theme.text,
          // ₹0 is a placeholder until a digit lands, so it reads as one.
          opacity: isEmpty ? 0.28 : 1,
        }}>
        {formatAmountEntry(value)}
      </ThemedText>
      <Animated.View
        style={{
          opacity: caretOpacity,
          width: 3,
          height: 40,
          marginLeft: 4,
          borderRadius: 2,
          backgroundColor: theme.accent,
        }}
      />
    </View>
  );
}

/**
 * The pad itself. It replaces the system keyboard rather than sitting beside
 * it: a decimal-pad has letters, punctuation and an emoji key competing with
 * ten digits, and it hides the sheet it belongs to.
 */
export function AmountKeypad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;

  const press = useCallback(
    (key: AmountKey) => {
      const next = appendAmountKey(value, key);
      if (next !== value) {
        haptics.select();
      }
      onChange(next);
    },
    [onChange, value]
  );

  const clear = useCallback(() => {
    if (value.length > 0) {
      haptics.removed();
    }
    onChange('');
  }, [onChange, value]);

  return (
    <View className="gap-2" accessibilityLabel="Amount keypad">
      {KEY_ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable
              key={key}
              testID={`amount-key-${key}`}
              accessibilityRole="button"
              accessibilityLabel={
                key === 'delete' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key
              }
              accessibilityHint={key === 'delete' ? 'Hold to clear the amount' : undefined}
              disabled={disabled}
              onPress={() => press(key)}
              onLongPress={key === 'delete' ? clear : undefined}
              className="flex-1 items-center justify-center rounded-2xl active:opacity-60"
              style={{
                height: KEY_HEIGHT,
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                opacity: disabled ? 0.4 : 1,
              }}>
              {key === 'delete' ? (
                <MaterialCommunityIcons name="backspace-outline" size={22} color={theme.text} />
              ) : (
                <ThemedText className="text-2xl font-black" style={{ color: theme.text }}>
                  {key}
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

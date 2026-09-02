import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export type DraftFieldCardProps = {
  testID?: string;
  label: string;
  /** The drafted value. Falls back to `placeholder` when the parser left it blank. */
  value?: string;
  placeholder?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  /** The parser was unsure — amber shell and a Check this chip. */
  flagged?: boolean;
  /** The user has since touched it, so the chip has been answered. */
  checked?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** An editor rendered in place of the value line — a text input, chips. */
  children?: React.ReactNode;
};

/**
 * One field on the AI draft review sheet.
 *
 * The amber shell is the whole point of the screen: a guessed field has to
 * look different from a quoted one. Once the user edits it the shell stands
 * down and the chip flips to "Checked", because an alert that never clears
 * stops being an alert.
 */
export function DraftFieldCard({
  testID,
  label,
  value,
  placeholder,
  icon,
  iconColor,
  flagged = false,
  checked = false,
  onPress,
  accessibilityLabel,
  children,
}: DraftFieldCardProps) {
  const themeTokens = useThemeTokens();
  const theme = themeTokens.colors;
  const isDark = themeTokens.mode === 'dark';
  const needsAttention = flagged && !checked;

  const shellStyle = {
    backgroundColor: needsAttention ? (isDark ? theme.secondary : '#FFFCF0') : theme.card,
    borderColor: needsAttention ? '#FDE68A' : theme.border,
  };
  const bubbleColor = needsAttention ? '#FEF3C7' : isDark ? theme.secondary : '#F3F4F6';
  const Shell = onPress ? Pressable : View;

  return (
    <View className="relative">
      {flagged && (
        <View
          className="absolute -top-2 right-4 z-10 rounded-lg px-2 py-0.5"
          style={{ backgroundColor: checked ? '#10B981' : '#FBBF24' }}>
          <ThemedText
            className="text-[8px] font-black"
            style={{ color: checked ? 'white' : 'black' }}>
            {checked ? 'Checked' : 'Check this'}
          </ThemedText>
        </View>
      )}
      <Shell
        testID={testID}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className="w-full flex-row items-center justify-between rounded-[20px] border p-3"
        style={shellStyle}>
        <View className="flex-1 flex-row items-center gap-3 pr-2">
          <View
            className="h-10 w-10 items-center justify-center"
            style={{
              backgroundColor: bubbleColor,
              borderRadius: themeTokens.icon.containerRadius,
            }}>
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={needsAttention ? '#F59E0B' : (iconColor ?? theme.accent)}
            />
          </View>
          <View className="flex-1">
            <ThemedText tone="muted" className="text-[10px] font-bold uppercase">
              {label}
            </ThemedText>
            {children ?? (
              <ThemedText
                numberOfLines={1}
                className="text-sm font-black"
                style={{ color: value ? theme.text : '#9CA3AF' }}>
                {value || placeholder || 'Not set'}
              </ThemedText>
            )}
          </View>
        </View>
        {onPress && <MaterialCommunityIcons name="chevron-down" size={22} color="#D1D5DB" />}
      </Shell>
    </View>
  );
}

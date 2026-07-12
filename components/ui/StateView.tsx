import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type StateViewProps = {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  loading?: boolean;
  compact?: boolean;
};

export function StateView({
  icon = 'information-outline',
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  loading = false,
  compact = false,
}: StateViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const surfaceColor = colorScheme === 'light' ? '#FFFFFF' : theme.card;
  const mutedText = colorScheme === 'light' ? 'rgba(45,45,45,0.62)' : 'rgba(250,250,250,0.68)';

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compactContainer : styles.fullContainer,
        {
          backgroundColor: surfaceColor,
          borderColor: theme.border,
        },
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.secondary }]}>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <MaterialCommunityIcons name={icon} size={compact ? 26 : 34} color={theme.accent} />
        )}
      </View>
      <ThemedText style={[styles.title, { color: theme.text }]}>{title}</ThemedText>
      {message ? (
        <ThemedText style={[styles.message, { color: mutedText }]}>{message}</ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.primaryButtonText}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSecondaryAction}
          style={styles.secondaryButton}>
          <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
            {secondaryActionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
  },
  fullContainer: {
    marginHorizontal: 24,
    paddingVertical: 32,
  },
  compactContainer: {
    paddingVertical: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: Fonts.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.body,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.title,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontFamily: Fonts.title,
    fontWeight: '700',
  },
});

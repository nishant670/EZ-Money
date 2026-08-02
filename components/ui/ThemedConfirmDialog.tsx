import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ThemedConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  iconName?: IconName;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ThemedConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  iconName = 'alert-circle-outline',
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
}: ThemedConfirmDialogProps) {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const actionColor = destructive ? '#EF5B5B' : colors.accent;
  const iconBackground = destructive
    ? theme.mode === 'dark'
      ? '#3A2424'
      : '#FFF0EC'
    : colors.secondary;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          disabled={loading}
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.dialog,
            theme.shadows.soft,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}>
          <View style={[styles.iconShell, { backgroundColor: iconBackground }]}>
            <MaterialCommunityIcons name={iconName} size={27} color={actionColor} />
          </View>
          <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
          <ThemedText
            style={[
              styles.message,
              { color: theme.mode === 'dark' ? 'rgba(255,255,255,0.58)' : '#6B7280' },
            ]}>
            {message}
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                  borderColor: colors.border,
                  opacity: pressed || loading ? 0.72 : 1,
                },
              ]}>
              <ThemedText style={[styles.cancelLabel, { color: colors.text }]}>
                {cancelLabel}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                {
                  borderColor: actionColor,
                  opacity: pressed || loading ? 0.72 : 1,
                },
              ]}>
              {loading ? (
                <ActivityIndicator color={actionColor} />
              ) : (
                <ThemedText style={[styles.confirmLabel, { color: actionColor }]}>
                  {confirmLabel}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ThemedDeleteDialog(
  props: Omit<ThemedConfirmDialogProps, 'destructive' | 'iconName'>
) {
  return <ThemedConfirmDialog {...props} destructive iconName="delete-outline" />;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dialog: {
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 384,
    padding: 24,
    width: '100%',
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  cancelButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelLabel: {
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmLabel: {
    fontWeight: '900',
    textAlign: 'center',
  },
});

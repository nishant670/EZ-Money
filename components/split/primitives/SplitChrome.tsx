import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const TText = cssInterop(ThemedText, { className: 'style' });

export type ActiveSection = 'groups' | 'friends' | 'activity';

export function SplitScreenFrame({
  embedded,
  backgroundColor,
  children,
}: {
  embedded: boolean;
  backgroundColor: string;
  children: ReactNode;
}) {
  if (embedded) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      {children}
    </SafeAreaView>
  );
}

export function SplitTopBar({
  loading,
  activeSection,
  searchVisible,
  onToggleSearch,
  onCreate,
}: {
  loading: boolean;
  activeSection: ActiveSection;
  searchVisible: boolean;
  onToggleSearch: () => void;
  onCreate: () => void;
}) {
  const theme = useThemeTokens().colors;
  const createIcon: keyof typeof MaterialCommunityIcons.glyphMap =
    activeSection === 'friends'
      ? 'account-plus-outline'
      : activeSection === 'activity'
        ? 'account-group-outline'
        : 'account-multiple-plus-outline';
  const createLabel =
    activeSection === 'friends'
      ? 'Add split friend'
      : activeSection === 'activity'
        ? 'Create split group'
        : 'Create split friend or group';
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <TText className="text-2xl" style={{ color: theme.text, fontFamily: Fonts.title }}>
        Split
      </TText>
      <View className="flex-row items-center gap-2">
        {loading ? <ActivityIndicator color={theme.accent} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchVisible ? 'Hide split search' : 'Search splits'}
          onPress={onToggleSearch}
          className="h-11 w-11 items-center justify-center rounded-full">
          <MaterialCommunityIcons
            name={searchVisible ? 'close' : 'magnify'}
            size={26}
            color={theme.text}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createLabel}
          onPress={onCreate}
          className="h-11 w-11 items-center justify-center rounded-full">
          <MaterialCommunityIcons name={createIcon} size={26} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  onClear,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View
      className="mb-5 min-h-12 flex-row items-center gap-3 rounded-2xl px-4"
      style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
      <MaterialCommunityIcons name="magnify" size={20} color={theme.accent} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search groups, friends, activity"
        placeholderTextColor={`${theme.text}B3`}
        autoCapitalize="none"
        style={{
          flex: 1,
          color: theme.text,
          fontFamily: Fonts.body,
          minHeight: 46,
        }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear}>
          <MaterialCommunityIcons name="close-circle" size={20} color={`${theme.text}CC`} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SegmentedSections({
  activeSection,
  onChange,
}: {
  activeSection: ActiveSection;
  onChange: (section: ActiveSection) => void;
}) {
  const theme = useThemeTokens().colors;
  const sections: {
    key: ActiveSection;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }[] = [
    { key: 'groups', label: 'Groups', icon: 'account-group-outline' },
    { key: 'friends', label: 'Friends', icon: 'account-outline' },
    { key: 'activity', label: 'Activity', icon: 'history' },
  ];

  return (
    <View
      className="flex-row rounded-2xl p-1"
      style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}>
      {sections.map((section) => {
        const selected = activeSection === section.key;
        return (
          <Pressable
            key={section.key}
            accessibilityRole="button"
            onPress={() => onChange(section.key)}
            className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl px-2"
            style={{
              backgroundColor: selected ? theme.secondary : 'transparent',
            }}>
            <MaterialCommunityIcons
              name={section.icon}
              size={17}
              color={selected ? theme.accent : `${theme.text}E6`}
            />
            <TText
              className="text-xs"
              style={{
                color: selected ? theme.accent : `${theme.text}F2`,
                fontFamily: Fonts.title,
              }}>
              {section.label}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettledHint({
  settledCount,
  onShowSettled,
}: {
  settledCount: number;
  onShowSettled: () => void;
}) {
  const theme = useThemeTokens().colors;
  if (settledCount <= 0) return null;

  return (
    <View className="items-center px-4 py-5">
      <TText className="text-center text-sm text-black/50 dark:text-white/50">
        Hiding groups that are settled up.
      </TText>
      <Pressable
        accessibilityRole="button"
        onPress={onShowSettled}
        className="mt-4 min-h-12 items-center justify-center rounded-full px-6"
        style={{ borderColor: theme.accent, borderWidth: 1 }}>
        <TText className="text-sm" style={{ color: theme.accent, fontFamily: Fonts.title }}>
          Show {settledCount} settled-up group{settledCount === 1 ? '' : 's'}
        </TText>
      </Pressable>
    </View>
  );
}

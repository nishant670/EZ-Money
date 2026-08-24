import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const TText = cssInterop(ThemedText, { className: 'style' });

export type BalanceFilter = 'all' | 'open' | 'owed_to_me' | 'i_owe' | 'settled';

export function BalanceFilterSheet({
  visible,
  selectedFilter,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedFilter: BalanceFilter;
  onSelect: (filter: BalanceFilter) => void;
  onClose: () => void;
}) {
  const theme = useThemeTokens().colors;
  const options: {
    filter: BalanceFilter;
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }[] = [
    {
      filter: 'open',
      title: 'Open balances',
      description: 'Hide settled groups and friends.',
      icon: 'scale-balance',
    },
    {
      filter: 'owed_to_me',
      title: 'Owed to me',
      description: 'Show only people and groups that owe you.',
      icon: 'arrow-down-bold-circle-outline',
    },
    {
      filter: 'i_owe',
      title: 'I owe',
      description: 'Show only balances you need to pay.',
      icon: 'arrow-up-bold-circle-outline',
    },
    {
      filter: 'settled',
      title: 'Settled up',
      description: 'Show settled groups and friends.',
      icon: 'check-circle-outline',
    },
    {
      filter: 'all',
      title: 'Everything',
      description: 'Show open and settled split records.',
      icon: 'format-list-bulleted',
    },
  ];

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <View
        className="rounded-t-[28px] border px-5 pb-8 pt-5"
        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="mb-4 flex-row items-center justify-between">
          <TText variant="sectionTitle">
            Filter balances
          </TText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.secondary }}>
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
        <View className="gap-2">
          {options.map((option) => {
            const selected = selectedFilter === option.filter;
            return (
              <Pressable
                key={option.filter}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.filter)}
                className="flex-row items-center gap-3 rounded-2xl p-3"
                style={{ backgroundColor: selected ? theme.secondary : 'transparent' }}>
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: selected ? theme.accent : theme.secondary }}>
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={19}
                    color={selected ? theme.onAccent : theme.accent}
                  />
                </View>
                <View className="flex-1">
                  <TText className="text-sm" style={{ fontFamily: Fonts.title }}>
                    {option.title}
                  </TText>
                  <TText className="mt-1 text-xs text-black/55 dark:text-white/55">
                    {option.description}
                  </TText>
                </View>
                {selected ? (
                  <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </AnimatedBottomSheet>
  );
}

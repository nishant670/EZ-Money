import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

export function GroupTile({ icon }: { icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const theme = useThemeTokens();

  return (
    <View
      className="h-[58px] w-[58px] items-center justify-center border"
      style={{
        backgroundColor: theme.colors.secondary,
        borderColor: theme.colors.border,
        borderRadius: theme.icon.containerRadius,
      }}>
      <View className="flex-1 items-center justify-center">
        <MaterialCommunityIcons name={icon} size={27} color={theme.colors.accent} />
      </View>
    </View>
  );
}

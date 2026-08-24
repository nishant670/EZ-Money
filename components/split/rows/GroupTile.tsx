import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

export function GroupTile({
  variant,
  icon,
}: {
  variant: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const theme = useThemeTokens().colors;
  const variants = [
    { base: theme.accent, top: `${theme.accent}B8`, bottom: `${theme.accent}D9` },
    { base: `${theme.accent}E8`, top: `${theme.accent}8F`, bottom: theme.accent },
    { base: `${theme.accent}D9`, top: `${theme.accent}73`, bottom: `${theme.accent}F2` },
    { base: theme.accent, top: `${theme.accent}A6`, bottom: `${theme.accent}CC` },
    { base: `${theme.accent}E0`, top: `${theme.accent}80`, bottom: theme.accent },
    { base: `${theme.accent}F0`, top: `${theme.accent}99`, bottom: `${theme.accent}C7` },
  ];
  const colors = variants[variant % variants.length];

  return (
    <View
      className="h-[86px] w-[86px] overflow-hidden rounded-xl"
      style={{ backgroundColor: colors.base }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 42,
          backgroundColor: colors.top,
          transform: [{ skewY: '28deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -12,
          bottom: -8,
          width: 74,
          height: 54,
          backgroundColor: colors.bottom,
          transform: [{ rotate: '-32deg' }],
        }}
      />
      <View className="flex-1 items-center justify-center">
        <MaterialCommunityIcons name={icon} size={38} color={theme.onAccent} />
      </View>
    </View>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * A group's tile: its photo when it has one, its kind icon when it does not.
 *
 * The two share one component so a photo can never be half-adopted — the
 * fallback is the same square, the same radius and the same border, so a list
 * of groups where only some have pictures still reads as one list.
 */
export function GroupAvatar({
  icon,
  photoUri,
  size = 58,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** A hosted URL, or a local file the user has just picked and not yet saved. */
  photoUri?: string | null;
  size?: number;
}) {
  const theme = useThemeTokens();
  const radius = theme.icon.containerRadius;

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{
          height: size,
          width: size,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.secondary,
        }}
        contentFit="cover"
        // The photo is the same bytes on every screen that draws the group, so
        // it is worth keeping on disk rather than refetching per list render.
        cachePolicy="memory-disk"
        transition={0}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      className="items-center justify-center border"
      style={{
        height: size,
        width: size,
        backgroundColor: theme.colors.secondary,
        borderColor: theme.colors.border,
        borderRadius: radius,
      }}>
      <MaterialCommunityIcons
        name={icon}
        size={Math.round(size * 0.47)}
        color={theme.colors.accent}
      />
    </View>
  );
}

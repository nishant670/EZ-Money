import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LOGO_SOURCE = require('@/assets/images/logo-white.png');

/**
 * The Finnri mark: the white glyph on a dark rounded tile, the thing on the
 * splash screen and in the Home header.
 *
 * It exists as a component because the app had been drawing two different
 * logos. Splash and Home both drew this one, each spelling the tile itself from
 * scratch — one hardcoding `#2D2D2D`, which is `palette.textLight` copied by
 * hand and therefore blind to the mood themes; the other reading the token. The
 * Welcome screen drew something else entirely, a lightning bolt in an accent
 * circle, so the first screen a new user ever sees introduced a brand the rest
 * of the app then dropped.
 *
 * One component means the next screen that needs the mark cannot invent a third
 * version of it.
 */
export function FinnriLogoMark({
  size = 48,
  style,
}: {
  /** Tile edge in px. The glyph and corner radius scale with it. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          alignItems: 'center',
          justifyContent: 'center',
          // Dark tile in light mode, raised card in dark mode — the glyph is
          // white, so it needs the dark ground in both.
          backgroundColor: colorScheme === 'light' ? theme.text : theme.card,
        },
        style,
      ]}>
      <Image
        source={LOGO_SOURCE}
        style={{ width: size * 0.62, height: size * 0.62, tintColor: '#FFF' }}
        resizeMode="contain"
      />
    </View>
  );
}

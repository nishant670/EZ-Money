import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { resolveThemeMode } from '@/constants/theme';
import { useAppMoodStore } from '@/hooks/use-app-mood-store';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const nightMode = useAppMoodStore((state) => state.nightMode);
  useAppMoodStore((state) => state.themeColor);
  useAppMoodStore((state) => state.iconStyle);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return resolveThemeMode(colorScheme, { nightMode });
  }

  return resolveThemeMode('light', { nightMode });
}

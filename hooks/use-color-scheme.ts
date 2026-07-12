import { useColorScheme as useRNColorScheme } from 'react-native';

import { resolveThemeMode } from '@/constants/theme';
import { useAppMoodStore } from '@/hooks/use-app-mood-store';

export function useColorScheme() {
  const systemColorScheme = useRNColorScheme();
  const nightMode = useAppMoodStore((state) => state.nightMode);
  useAppMoodStore((state) => state.themeColor);
  useAppMoodStore((state) => state.iconStyle);

  return resolveThemeMode(systemColorScheme, { nightMode });
}

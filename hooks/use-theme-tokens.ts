import { getThemeTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeTokens() {
  const colorScheme = useColorScheme() ?? 'light';
  return getThemeTokens(colorScheme);
}

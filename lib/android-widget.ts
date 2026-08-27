import { NativeModules, Platform } from 'react-native';

import { formatMoney } from '@/lib/money';

type FinnriWidgetModule = {
  updateMonthSpend(amount: string, month: string): void;
};

const monthName = (periodStart?: string) => {
  const match = periodStart?.match(/^(\d{4})-(\d{2})-/);
  if (!match) return 'This month';
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString('en-IN', {
    month: 'long',
  });
};

/** Refresh the Android home-screen widget from the same server total Home
 * renders. Other platforms and Expo Go simply have no native module, so this
 * remains a safe no-op. */
export const updateAndroidMonthWidget = (totalSpent: number, periodStart?: string) => {
  if (Platform.OS !== 'android') return;
  const widget = NativeModules.FinnriWidget as FinnriWidgetModule | undefined;
  widget?.updateMonthSpend(formatMoney(totalSpent), monthName(periodStart));
};

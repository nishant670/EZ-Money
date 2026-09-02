import AsyncStorage from '@react-native-async-storage/async-storage';

/** Keep the completion prompt useful without turning every launch into nagging. */
export const ACCOUNT_SETUP_NUDGE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const ACCOUNT_SETUP_NUDGE_SNOOZE_KEY = 'finnri_account_setup_snoozed_until';

export const snoozeAccountSetupNudge = async (now = Date.now()) => {
  try {
    await AsyncStorage.setItem(
      ACCOUNT_SETUP_NUDGE_SNOOZE_KEY,
      String(now + ACCOUNT_SETUP_NUDGE_SNOOZE_MS)
    );
  } catch {
    // A secondary prompt must never make Home fail to open.
  }
};

export const isAccountSetupNudgeSnoozed = async (now = Date.now()) => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_SETUP_NUDGE_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
};

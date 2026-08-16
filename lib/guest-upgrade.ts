import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * How many saved entries a guest has to have before the app asks them to make an
 * account. The prompt is meant to arrive after the value, not before it: three
 * is enough for the ask to name something the user would actually mind losing.
 */
export const GUEST_UPGRADE_MIN_ENTRIES = 3;

/**
 * How long "Not now" holds. Long enough that the prompt is not the thing they
 * see every time they open the app, short enough that a guest who keeps logging
 * is asked again while their data is still worth protecting.
 */
export const GUEST_UPGRADE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const GUEST_UPGRADE_SNOOZE_KEY = 'finnri_guest_upgrade_snoozed_until';

export const snoozeGuestUpgradePrompt = async (now = Date.now()) => {
  try {
    await AsyncStorage.setItem(GUEST_UPGRADE_SNOOZE_KEY, String(now + GUEST_UPGRADE_SNOOZE_MS));
  } catch {
    // A prompt shown one extra time is a smaller failure than a crash on Home.
  }
};

export const clearGuestUpgradeSnooze = async () => {
  try {
    await AsyncStorage.removeItem(GUEST_UPGRADE_SNOOZE_KEY);
  } catch {
    // Same reasoning as above.
  }
};

export const isGuestUpgradePromptSnoozed = async (now = Date.now()) => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_UPGRADE_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
};

/**
 * Whether the upgrade prompt has earned its place on screen. Signed-in users are
 * never asked, and a guest is only asked once they have something to lose.
 */
export const shouldShowGuestUpgradePrompt = ({
  isGuest,
  entryCount,
  isSnoozed,
}: {
  isGuest: boolean;
  entryCount: number;
  isSnoozed: boolean;
}) => isGuest && !isSnoozed && entryCount >= GUEST_UPGRADE_MIN_ENTRIES;

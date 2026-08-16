import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GUEST_UPGRADE_MIN_ENTRIES,
  GUEST_UPGRADE_SNOOZE_MS,
  clearGuestUpgradeSnooze,
  isGuestUpgradePromptSnoozed,
  shouldShowGuestUpgradePrompt,
  snoozeGuestUpgradePrompt,
} from '@/lib/guest-upgrade';

const NOW = Date.parse('2026-08-12T10:00:00.000Z');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('guest upgrade prompt', () => {
  it('waits until the guest has entries worth keeping', () => {
    for (let entryCount = 0; entryCount < GUEST_UPGRADE_MIN_ENTRIES; entryCount += 1) {
      expect(
        shouldShowGuestUpgradePrompt({ isGuest: true, entryCount, isSnoozed: false })
      ).toBe(false);
    }

    expect(
      shouldShowGuestUpgradePrompt({
        isGuest: true,
        entryCount: GUEST_UPGRADE_MIN_ENTRIES,
        isSnoozed: false,
      })
    ).toBe(true);
  });

  it('never asks a signed-in user', () => {
    expect(
      shouldShowGuestUpgradePrompt({ isGuest: false, entryCount: 50, isSnoozed: false })
    ).toBe(false);
  });

  it('respects a dismissal', () => {
    expect(
      shouldShowGuestUpgradePrompt({ isGuest: true, entryCount: 50, isSnoozed: true })
    ).toBe(false);
  });

  it('holds the snooze for its window and then asks again', async () => {
    await snoozeGuestUpgradePrompt(NOW);

    expect(await isGuestUpgradePromptSnoozed(NOW)).toBe(true);
    expect(await isGuestUpgradePromptSnoozed(NOW + GUEST_UPGRADE_SNOOZE_MS - 1)).toBe(true);
    expect(await isGuestUpgradePromptSnoozed(NOW + GUEST_UPGRADE_SNOOZE_MS + 1)).toBe(false);
  });

  it('reads as un-snoozed when nothing has been stored', async () => {
    expect(await isGuestUpgradePromptSnoozed(NOW)).toBe(false);
  });

  it('clears the snooze so a fresh guest is asked again', async () => {
    await snoozeGuestUpgradePrompt(NOW);
    await clearGuestUpgradeSnooze();
    expect(await isGuestUpgradePromptSnoozed(NOW)).toBe(false);
  });
});

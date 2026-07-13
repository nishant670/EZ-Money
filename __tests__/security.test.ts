import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteLocalSecurityPin,
  hasLocalSecurityPin,
  saveLocalSecurityPin,
  verifyLocalSecurityPin,
} from '@/lib/security';

describe('local security PIN storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('stores a hashed PIN record and verifies the PIN', async () => {
    await saveLocalSecurityPin('user-1', '1234');

    expect(await hasLocalSecurityPin('user-1')).toBe(true);
    expect(await verifyLocalSecurityPin('user-1', '1234')).toBe(true);
    expect(await verifyLocalSecurityPin('user-1', '4321')).toBe(false);

    const keys = await AsyncStorage.getAllKeys();
    const rawRecord = await AsyncStorage.getItem(keys[0]);
    expect(rawRecord).toBeTruthy();
    expect(rawRecord).not.toContain('1234');
  });

  it('deletes a stored PIN record', async () => {
    await saveLocalSecurityPin('user-1', '1234');
    await deleteLocalSecurityPin('user-1');

    expect(await hasLocalSecurityPin('user-1')).toBe(false);
    expect(await verifyLocalSecurityPin('user-1', '1234')).toBe(false);
  });
});

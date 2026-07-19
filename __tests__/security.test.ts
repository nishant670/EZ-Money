import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteLocalSecurityPin,
  hasLocalSecurityPin,
  isValidSecurityPin,
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

  it('rejects repeated-digit default PINs', async () => {
    expect(isValidSecurityPin('0000')).toBe(false);
    expect(isValidSecurityPin('1111')).toBe(false);
    expect(isValidSecurityPin('1234')).toBe(true);

    await expect(saveLocalSecurityPin('user-1', '0000')).rejects.toThrow(
      'Choose a PIN that is not the same digit repeated.'
    );
    expect(await hasLocalSecurityPin('user-1')).toBe(false);
  });

  it('deletes a stored PIN record', async () => {
    await saveLocalSecurityPin('user-1', '1234');
    await deleteLocalSecurityPin('user-1');

    expect(await hasLocalSecurityPin('user-1')).toBe(false);
    expect(await verifyLocalSecurityPin('user-1', '1234')).toBe(false);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'finnri_device_id';
// The pre-rename key. An install that already has one keeps its id rather than
// registering as a second device: read it once, copy it forward, drop it.
const LEGACY_DEVICE_ID_KEY = 'ez_money_device_id';

export const getDeviceId = async () => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const legacyId = await AsyncStorage.getItem(LEGACY_DEVICE_ID_KEY);
    if (legacyId) {
      await AsyncStorage.setItem(DEVICE_ID_KEY, legacyId);
      await AsyncStorage.removeItem(LEGACY_DEVICE_ID_KEY);
      return legacyId;
    }
  }
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

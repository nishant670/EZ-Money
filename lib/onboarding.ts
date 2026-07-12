import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = 'finnri_onboarding_complete';

export const hasCompletedOnboarding = async () => {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === 'true';
};

export const markOnboardingComplete = async () => {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
};

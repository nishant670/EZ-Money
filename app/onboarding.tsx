import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { guestCheckin } from '@/lib/auth';
import { getDeviceId } from '@/lib/device';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    SlideInLeft,
    SlideInRight,
    SlideOutLeft,
    SlideOutRight
} from 'react-native-reanimated';

import { OnboardingScreenWrapper } from '@/components/onboarding/OnboardingScreenWrapper';
import Screen1 from '@/components/onboarding/Screen1';
import Screen2 from '@/components/onboarding/Screen2';
import Screen3 from '@/components/onboarding/Screen3';
import Screen4 from '@/components/onboarding/Screen4';
import Screen5 from '@/components/onboarding/Screen5';

const { width } = Dimensions.get('window');

const SCREENS = [
  { id: 1, component: Screen1 },
  { id: 2, component: Screen2 },
  { id: 3, component: Screen3 },
  { id: 4, component: Screen4 },
  { id: 5, component: Screen5 },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [isGuestChecking, setIsGuestChecking] = useState(false);

  const CurrentScreen = SCREENS[activeIndex].component;

  const handleNext = () => {
    if (activeIndex < SCREENS.length - 1) {
      setDirection('forward');
      setTimeout(() => setActiveIndex(activeIndex + 1), 0);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      setDirection('back');
      setTimeout(() => setActiveIndex(activeIndex - 1), 0);
    }
  };

  const handleFinish = () => {
    router.replace('/auth');
  };

  const handleGuestContinue = async () => {
    setGuestError(null);
    setIsGuestChecking(true);
    try {
      const deviceId = await getDeviceId();
      const response = await guestCheckin({
        device_id: deviceId,
      });
      if (response?.user) {
        setAuth(response.user, response.token);
      }
      router.replace('/(tabs)');
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Unable to continue as guest.');
    } finally {
      setIsGuestChecking(false);
    }
  };

  const enteringAnimation = direction === 'forward' ? SlideInRight.duration(400) : SlideInLeft.duration(400);
  const exitingAnimation = direction === 'forward' ? SlideOutLeft.duration(400) : SlideOutRight.duration(400);

  return (
    <OnboardingScreenWrapper>
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.header}>
            {/* {activeIndex < SCREENS.length - 1 && (
                <TouchableOpacity onPress={handleFinish} style={styles.skipButton}>
                    <Text style={[styles.skipText, { color: theme.text, opacity: 0.5 }]}>Skip</Text>
                </TouchableOpacity>
            ) || <View style={styles.skipButton} />} */}
            
            <View style={styles.progressContainer}>
                {SCREENS.map((_, index) => (
                    <View 
                        key={index} 
                        style={[
                            styles.progressDot, 
                            { 
                                backgroundColor: index === activeIndex ? theme.accent : theme.border,
                                width: index === activeIndex ? 20 : 6
                            }
                        ]} 
                    />
                ))}
            </View>
        </View>

        {/* Content Area */}
        <Animated.View 
            key={activeIndex} 
            entering={enteringAnimation} 
            exiting={exitingAnimation}
            style={styles.screenContainer}
        >
            <CurrentScreen />
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
            <View style={styles.navRow}>
                {activeIndex > 0 ? (
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Text style={[styles.footerBtnText, { color: theme.text, opacity: 0.6 }]}>Back</Text>
                    </TouchableOpacity>
                ) : <View style={styles.footerBtnPlaceholder} />}

                <TouchableOpacity
                    onPress={handleNext}
                    style={[
                        styles.primaryButton,
                        { backgroundColor: activeIndex === SCREENS.length - 1 ? theme.accent : theme.text }
                    ]}
                >
                    <Text style={[styles.primaryButtonText, { color: activeIndex === SCREENS.length - 1 ? 'white' : theme.background }]}>
                        {activeIndex === SCREENS.length - 1 ? 'Sign in' : 'Next'}
                    </Text>
                    <MaterialCommunityIcons
                        name="arrow-right"
                        size={18}
                        color={activeIndex === SCREENS.length - 1 ? 'white' : theme.background}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                onPress={handleGuestContinue}
                disabled={isGuestChecking}
                style={[
                    styles.guestButton,
                    {
                        borderColor: theme.border,
                        backgroundColor: theme.card,
                        opacity: isGuestChecking ? 0.7 : 1,
                    },
                ]}
            >
                {isGuestChecking ? (
                    <ActivityIndicator color={theme.accent} />
                ) : (
                    <Text style={[styles.guestButtonText, { color: theme.text }]}>Continue as guest</Text>
                )}
            </TouchableOpacity>
            {guestError ? <Text style={styles.errorText}>{guestError}</Text> : null}
        </View>

        {/* {activeIndex === SCREENS.length - 1 && (
            <TouchableOpacity onPress={handleFinish} style={styles.skipForNow}>
                <Text style={[styles.skipForNowText, { color: theme.text, opacity: 0.4 }]}>Skip for now</Text>
            </TouchableOpacity>
        )} */}
      </View>
    </OnboardingScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 10,
  },
  skipButton: {
      padding: 8,
      width: 60,
  },
  skipText: {
      fontSize: 14,
      fontWeight: '600',
  },
  progressContainer: {
      flexDirection: 'row',
      gap: 6,
      position: 'absolute',
      width: width,
      justifyContent: 'center',
      zIndex: -1,
  },
  progressDot: {
      height: 4,
      borderRadius: 2,
  },
  screenContainer: {
      flex: 1,
  },
  footer: {
      paddingHorizontal: 24,
      paddingBottom: 40,
  },
  navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
  },
  footerBtnPlaceholder: {
      width: 60,
  },
  backButton: {
      padding: 8,
      width: 60,
  },
  footerBtnText: {
      fontSize: 16,
      fontWeight: '600',
  },
  primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 30,
      paddingVertical: 16,
      borderRadius: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
  },
  primaryButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
  },
  guestButton: {
      width: '100%',
      minHeight: 54,
      borderRadius: 27,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
  },
  guestButtonText: {
      fontSize: 16,
      fontWeight: '700',
  },
  errorText: {
      marginTop: 10,
      fontSize: 12,
      color: '#D32F2F',
      textAlign: 'center',
  },
  skipForNow: {
      alignItems: 'center',
      paddingBottom: 20,
  },
  skipForNowText: {
      fontSize: 13,
      fontWeight: '600',
  }
});

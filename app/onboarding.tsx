import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMotion } from '@/hooks/use-motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { hasCompletedOnboarding, markOnboardingComplete } from '@/lib/onboarding';

const { width } = Dimensions.get('window');

/**
 * Four slides, not five. The fifth was a "You're all set to take control!"
 * celebration for an account that did not exist yet and a user who had logged
 * nothing — and the signup flow then celebrated a second time on the screen
 * after it. The one celebration left is the one that follows an actual event.
 */
const SCREENS = [
  { id: 1, component: Screen1 },
  { id: 2, component: Screen2 },
  { id: 3, component: Screen3 },
  { id: 4, component: Screen4 },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  const CurrentScreen = SCREENS[activeIndex].component;

  useEffect(() => {
    let isMounted = true;

    const guardCompletedOnboarding = async () => {
      if (await hasCompletedOnboarding()) {
        router.replace('/auth');
        return;
      }

      if (isMounted) {
        setIsCheckingOnboarding(false);
      }
    };

    guardCompletedOnboarding();

    return () => {
      isMounted = false;
    };
  }, [router]);

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

  const handleFinish = async () => {
    await markOnboardingComplete();
    router.replace('/auth');
  };

  const motion = useMotion();

  // A screen push, on the `sheet` token. These used to run 400ms flat in both
  // directions and honoured nothing — the outgoing screen is already gone as
  // far as the user is concerned, and reduced motion could not switch them off.
  const enterMs = motion.duration('sheet');
  const exitMs = motion.exitDuration('sheet');
  const enteringAnimation =
    direction === 'forward' ? SlideInRight.duration(enterMs) : SlideInLeft.duration(enterMs);
  const exitingAnimation =
    direction === 'forward' ? SlideOutLeft.duration(exitMs) : SlideOutRight.duration(exitMs);

  if (isCheckingOnboarding) {
    return null;
  }

  return (
    <OnboardingScreenWrapper>
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.header}>
            {/* Skip is offered from the first slide. Hiding it there only made
                the one user who wanted out sit through a slide to find it. */}
            <TouchableOpacity onPress={handleFinish} style={styles.skipButton}>
                <Text style={[styles.skipText, { color: theme.text, opacity: 0.5 }]}>Skip</Text>
            </TouchableOpacity>
            
            {/* Decorative, and absolutely positioned across the full width of
                the header — so it lies over Skip. It used to carry `zIndex: -1`
                to sit behind, which on Android reorders painting but not touch
                dispatch: Skip rendered on slide 1 and did nothing until the
                screen had re-rendered once. `pointerEvents` is the honest way to
                say a progress indicator is not a target. */}
            <View pointerEvents="none" style={styles.progressContainer}>
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
                        {activeIndex === SCREENS.length - 1 ? 'Get started' : 'Next'}
                    </Text>
                    <MaterialCommunityIcons
                        name="arrow-right"
                        size={18}
                        color={activeIndex === SCREENS.length - 1 ? 'white' : theme.background}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </View>
        </View>

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
});

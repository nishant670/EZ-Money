import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMotion } from '@/hooks/use-motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

/**
 * Four slides, one capability each: say it, Finnri reads it, split it, Finnri
 * watches it.
 *
 * Four, not five. The fifth was a "You're all set to take control!" celebration
 * for an account that did not exist yet and a user who had logged nothing — and
 * the signup flow then celebrated a second time on the screen after it. The one
 * celebration left is the one that follows an actual event.
 *
 * Staying at four through a feature refresh meant spending the slots rather
 * than adding to them. Reviewing a parsed entry had a slide of its own saying
 * what the slide before it had already said, so it became one line on that
 * slide's card, and splitting — the thing people open the app for with someone
 * else standing next to them — took the slot it left.
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
    // The flag is a convenience, not a gate. If the write fails the user has
    // still asked to leave, and an unhandled rejection here would strand them
    // on the screen whose only exit they just pressed — the same dead button,
    // arrived at from the other side. Worst case onboarding shows once more.
    try {
      await markOnboardingComplete();
    } catch {
      // Deliberately swallowed; see above.
    }
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
            <TouchableOpacity
                onPress={handleFinish}
                style={styles.skipButton}
                accessibilityRole="button"
                hitSlop={12}>
                <Text style={[styles.skipText, { color: theme.text, opacity: 0.5 }]}>Skip</Text>
            </TouchableOpacity>

            {/* Centred by the layout rather than by lying a full-width absolute
                view across the row.

                Two fixes were already spent trying to keep these dots on top of
                Skip without eating its tap: `zIndex: -1`, which on Android
                reorders painting but not touch dispatch, and then
                `pointerEvents="none"`, which is the correct spelling of "not a
                target" and *still* left the button dead on the first slide in
                build 47da4506. Rather than guess at a third mechanism, the
                overlap is gone: a view that does not lie over the button cannot
                swallow its tap by any mechanism at all.

                The spacer opposite Skip is what keeps the dots centred on the
                header rather than on the space left over beside it. The footer's
                nav row already centres itself this way. */}
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

            <View style={styles.headerSpacer} />
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
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
  },
  headerSpacer: {
      width: 60,
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

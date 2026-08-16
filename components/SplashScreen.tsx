import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { FinnriLogoMark } from '@/components/FinnriLogoMark';

interface FinnriSplashScreenProps {
  onAnimationComplete?: () => void;
}

export function FinnriSplashScreen({ onAnimationComplete }: FinnriSplashScreenProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        completionTimer = setTimeout(() => {
          onAnimationComplete?.();
        }, 1500);
      }
    });

    return () => {
      animation.stop();
      if (completionTimer) {
        clearTimeout(completionTimer);
      }
    };
  }, [fadeAnim, onAnimationComplete, scaleAnim, slideAnim]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View 
        style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Logo Container */}
        <FinnriLogoMark size={100} style={styles.logoContainer} />

        {/* Tagline */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Text style={[styles.tagline, { color: theme.text, fontFamily: Fonts.title }]}>
            money, made intelligent
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Footer / Powered by */}
      <View style={styles.footer}>
         <Text style={[styles.footerText, { color: theme.text, opacity: 0.3 }]}>
            FINNRI
         </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  // Size, radius and ground come from the mark itself; what is left here is
  // only what this screen adds on top of it.
  logoContainer: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 24,
  },
  logo: {
    height: 60,
    width: 60,
    tintColor: '#FFF',
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  footer: {
      position: 'absolute',
      bottom: 50,
  },
  footerText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 4,
  }
});

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

export default function Screen1() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);

  useEffect(() => {
    pulse1.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1500, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
    
    setTimeout(() => {
      pulse2.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 1800, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 1800, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    }, 500);
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: 0.3 - (pulse1.value - 1) * 0.3,
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: 0.2 - (pulse2.value - 1) * 0.2,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.micCircleContainer}>
          <Animated.View style={[styles.pulseCircle, { backgroundColor: theme.accent }, animatedStyle1]} />
          <Animated.View style={[styles.pulseCircle, { backgroundColor: theme.accent }, animatedStyle2]} />
          <View style={[styles.micBox, { backgroundColor: theme.accent }]}>
             <MaterialCommunityIcons name="microphone" size={40} color="white" />
          </View>
        </View>

        <View style={[styles.speechBubble, { backgroundColor: theme.card }]}>
          <View style={styles.waveform}>
              {[1, 2, 3, 4].map(i => (
                  <View key={i} style={[styles.waveItem, { backgroundColor: theme.accent, height: 10 + Math.random() * 10 }]} />
              ))}
          </View>
          <Text style={[styles.speechText, { color: theme.text }]}>"Spent ₹250 on lunch via UPI"</Text>
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.title }]}>
            Just speak your <Text style={{ color: theme.accent }}>expenses</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: Fonts.body }]}>
            Tell Finnri what you spent or earned. No forms, no effort.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  micCircleContainer: {
    height: 140,
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pulseCircle: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
  },
  micBox: {
    height: 80,
    width: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8865',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 40,
  },
  waveform: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 10,
      gap: 2,
  },
  waveItem: {
      width: 3,
      borderRadius: 1.5,
  },
  speechText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textGroup: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

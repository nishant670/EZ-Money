import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Screen5() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.visualContainer}>
          <View style={[styles.mainCircle, { borderColor: theme.accent + '20' }]}>
             <View style={[styles.innerCircle, { backgroundColor: theme.accent + '10' }]}>
                <View style={[styles.rocketBox, { backgroundColor: theme.accent + '20' }]}>
                   <MaterialCommunityIcons name="rocket-launch" size={50} color={theme.accent} />
                </View>
             </View>
             
             {/* Small floating icons */}
             <View style={[styles.floatingIcon, styles.starIcon, { backgroundColor: 'white' }]}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
             </View>
             <View style={[styles.floatingIcon, styles.checkIcon, { backgroundColor: '#27C93F' }]}>
                <MaterialCommunityIcons name="check" size={12} color="white" />
             </View>
             <View style={[styles.floatingIcon, styles.walletIcon, { backgroundColor: '#4A90E2' }]}>
                <MaterialCommunityIcons name="wallet" size={14} color="white" />
             </View>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.title }]}>
            You&apos;re all set to take <Text style={{ color: theme.accent }}>control!</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: Fonts.body }]}>
            Start tracking, save more, and feel great about your money.
          </Text>
          
          <View style={styles.securityNote}>
             <MaterialCommunityIcons name="lock" size={12} color={theme.text} style={{ opacity: 0.4 }} />
             <Text style={[styles.securityText, { color: theme.text, opacity: 0.4 }]}>No bank connection required</Text>
          </View>
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
  visualContainer: {
    width: '100%',
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  mainCircle: {
      width: 240,
      height: 240,
      borderRadius: 120,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
  },
  innerCircle: {
      width: 200,
      height: 200,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
  },
  rocketBox: {
      width: 120,
      height: 120,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF8865',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 5,
  },
  floatingIcon: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
  },
  starIcon: {
      top: 60,
      left: 20,
  },
  checkIcon: {
      top: 40,
      right: 20,
  },
  walletIcon: {
      bottom: 40,
      right: 30,
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
    marginBottom: 24,
  },
  securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  securityText: {
      fontSize: 12,
      fontWeight: '600',
  }
});

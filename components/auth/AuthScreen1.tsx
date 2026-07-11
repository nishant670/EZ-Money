import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';
import { ScreenProps } from './types';

type AuthScreen1Props = ScreenProps & {
  errorMessage?: string | null;
  isLoading?: boolean;
};

export const AuthScreen1 = ({
  onContinue,
  onSecondary,
  errorMessage,
  isLoading,
}: AuthScreen1Props) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <ScrollView
      contentContainerStyle={[styles.authScrollContent, { flexGrow: 1, justifyContent: 'center' }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topSection}>
        <View style={styles.logoRow}>
          <View style={[styles.logoCircle, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="white" />
          </View>
          <Text style={[styles.logoText, { color: theme.text }]}>finnri</Text>
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.glowCircle} />
          <View style={[styles.mainCircle, { borderColor: theme.border }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FF8A65' }]}>
              <MaterialCommunityIcons name="wallet" size={30} color="white" />
            </View>
            <View style={[styles.smallIcon, styles.pos1, { backgroundColor: '#E1BEE7' }]}>
              <MaterialCommunityIcons name="star" size={12} color="#9C27B0" />
            </View>
            <View style={[styles.smallIcon, styles.pos2, { backgroundColor: '#C8E6C9' }]}>
              <MaterialCommunityIcons name="trending-up" size={12} color="#43A047" />
            </View>
            <View style={[styles.smallIcon, styles.pos3, { backgroundColor: '#FFCCBC' }]}>
              <MaterialCommunityIcons name="emoticon-happy" size={12} color="#E64A19" />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.textSection}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome to Finnri</Text>
        <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6 }]}>
          Track your money intelligently — your way.
        </Text>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: isLoading ? 0.6 : 1 },
          ]}
          disabled={!!isLoading}
          onPress={() => onContinue('guest')}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in / Create account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textButton}
          onPress={() => onSecondary?.()}
        >
          <Text style={[styles.textButtonText, { color: theme.text, opacity: 0.75 }]}>
            Continue as Guest
          </Text>
        </TouchableOpacity>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
    </ScrollView>
  );
};

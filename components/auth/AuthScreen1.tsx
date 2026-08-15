import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';

type AuthScreen1Props = {
  /** Guest check-in. The primary path: it goes straight to the app. */
  onGuest: () => void;
  onGoogle?: () => void;
  /** The email/mobile signup path, demoted to a text link. */
  onIdentifier: () => void;
  errorMessage?: string | null;
  isGuestLoading?: boolean;
  isGoogleLoading?: boolean;
};

/**
 * The Welcome screen. Guest is the primary button because it is the only option
 * here that ends in the user seeing their own money — every other path spends
 * screens before it does anything. Signing in stays one tap away, and the
 * upgrade prompt on Home asks again once there is data worth keeping.
 */
export const AuthScreen1 = ({
  onGuest,
  onGoogle,
  onIdentifier,
  errorMessage,
  isGuestLoading,
  isGoogleLoading,
}: AuthScreen1Props) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isBusy = !!isGuestLoading || !!isGoogleLoading;

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
            <View style={[styles.iconBox, { backgroundColor: theme.accent }]}>
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
          accessibilityRole="button"
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: isBusy ? 0.6 : 1 },
          ]}
          disabled={isBusy}
          onPress={onGuest}
        >
          {isGuestLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Start tracking — it&apos;s free</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="white"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
        </TouchableOpacity>

        {/* The guest terms, stated before the tap rather than on a screen after
            it. This is what the interstitial used to say. */}
        <Text style={[styles.helperText, { color: theme.text, opacity: 0.55 }]}>
          No account needed. Your data stays on this device — sign in any time to back it up.
        </Text>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.text, opacity: 0.4 }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.googleButton, { borderColor: theme.border, opacity: isBusy ? 0.6 : 1 }]}
          disabled={isBusy || !onGoogle}
          onPress={onGoogle}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Text style={styles.googleMark}>G</Text>
              <Text style={[styles.googleButtonText, { color: theme.text }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.textButton}
          disabled={isBusy}
          onPress={onIdentifier}
        >
          <Text style={[styles.textButtonText, { color: theme.text, opacity: 0.75 }]}>
            Use email or mobile
          </Text>
        </TouchableOpacity>

        {errorMessage ? (
          <View style={styles.smartErrorContainer}>
            <View style={styles.errorIconBox}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#D32F2F" />
            </View>
            <Text style={styles.smartErrorText} numberOfLines={2}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.trustNote}>
          <MaterialCommunityIcons name="lock" size={12} color={theme.text} style={{ opacity: 0.4 }} />
          <Text style={[styles.trustNoteText, { color: theme.text, opacity: 0.4 }]}>
            No bank connection required
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

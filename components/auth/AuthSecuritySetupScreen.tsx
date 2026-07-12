import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

import { AuthPinSetupScreen } from './AuthPinSetupScreen';
import { styles } from './styles';
import { ScreenProps } from './types';

export const AuthSecuritySetupScreen = ({
  onContinue,
  onSecondary,
  isLoading,
  errorMessage: externalError
}: ScreenProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [isBiometricsVerified, setIsBiometricsVerified] = React.useState(false);
  const [isCheckingBiometrics, setIsCheckingBiometrics] = React.useState(false);
  const [pinConfigured, setPinConfigured] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = React.useState(false);
  const [pin, setPin] = React.useState('0000');

  const displayError = localError || externalError;

  const handleBiometricsToggle = async (nextValue: boolean) => {
    setLocalError(null);
    if (!nextValue) {
      setBiometricsEnabled(false);
      setIsBiometricsVerified(false);
      return;
    }

    setIsCheckingBiometrics(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setLocalError('Biometrics not available on this device.');
        setBiometricsEnabled(false);
        setIsBiometricsVerified(false);
        return;
      }
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setLocalError('No biometrics enrolled. Set up Face ID or Touch ID first.');
        setBiometricsEnabled(false);
        setIsBiometricsVerified(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your biometrics to continue',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricsEnabled(true);
        setIsBiometricsVerified(true);
      } else {
        setLocalError('Biometric verification failed.');
        setBiometricsEnabled(false);
        setIsBiometricsVerified(false);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to verify biometrics.');
      setBiometricsEnabled(false);
      setIsBiometricsVerified(false);
    } finally {
      setIsCheckingBiometrics(false);
    }
  };

  const handlePinComplete = (newPin: string) => {
    setPin(newPin);
    setPinConfigured(true);
    setIsSettingPin(false);
    setLocalError(null);
  };

  if (isSettingPin) {
    return (
      <AuthPinSetupScreen
        onComplete={handlePinComplete}
        onCancel={() => setIsSettingPin(false)}
        isLoading={isLoading}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.authScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <View style={styles.imageContainer}>
            <View style={styles.glowCircle} />
            <View style={[styles.mainCircle, { borderColor: theme.border }]}>
              <View style={[styles.iconBox, { backgroundColor: '#FFCCBC' }]}>
                <MaterialCommunityIcons name="shield-lock" size={40} color="#E64A19" />
              </View>
              <View style={[styles.smallIcon, styles.pos1, { backgroundColor: '#E1F5FE' }]}>
                <MaterialCommunityIcons name="fingerprint" size={16} color="#03A9F4" />
              </View>
              <View style={[styles.smallIcon, styles.pos2, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="dialpad" size={16} color="#4CAF50" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.textSection}>
          <Text style={[styles.title, { color: theme.text, fontSize: 26 }]}>Protect your Finnri data</Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6 }]}>
            Set up a PIN or enable Biometrics to keep your spending records private.
          </Text>
        </View>

        <View style={styles.securityOptionsSection}>
          <View style={[styles.securityCard, { backgroundColor: 'white' }]}>
            <View style={[styles.securityIconBox, { backgroundColor: '#F3E5F5' }]}>
              <MaterialCommunityIcons name="face-recognition" size={24} color="#7B1FA2" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.securityTitle, { color: theme.text }]}>Biometrics</Text>
              <Text style={[styles.securitySubtitle, { color: theme.text, opacity: 0.4 }]}>
                Use Face ID or Touch ID
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleBiometricsToggle}
              trackColor={{ false: '#f4f3f4', true: theme.accent }}
              thumbColor="white"
              disabled={isCheckingBiometrics}
            />
          </View>
          <TouchableOpacity
            style={[styles.securityCard, { backgroundColor: 'white', marginTop: 12 }]}
            onPress={() => {
              setIsSettingPin(true);
              setLocalError(null);
            }}
          >
            <View style={[styles.securityIconBox, { backgroundColor: pinConfigured ? '#E8F5E9' : '#FFEBEE' }]}>
              <MaterialCommunityIcons
                name={pinConfigured ? "check-circle" : "dialpad"}
                size={24}
                color={pinConfigured ? "#2E7D32" : "#C62828"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.securityTitle, { color: theme.text }]}>
                {pinConfigured ? "PIN Configured" : "Set up a PIN"}
              </Text>
              <Text style={[styles.securitySubtitle, { color: theme.text, opacity: 0.4 }]}>
                {pinConfigured ? "You can change your PIN here" : "Create a 4-digit code"}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.text}
              style={{ opacity: 0.3 }}
            />
          </TouchableOpacity>
        </View>
        {isCheckingBiometrics ? <ActivityIndicator color={theme.accent} /> : null}
        {displayError ? (
          <View style={styles.smartErrorContainer}>
            <View style={styles.errorIconBox}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#D32F2F" />
            </View>
            <Text style={styles.smartErrorText} numberOfLines={2}>
              {displayError}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.accent,
                opacity: (isBiometricsVerified || pinConfigured) && !isLoading ? 1 : 0.6,
              },
            ]}
            disabled={(!isBiometricsVerified && !pinConfigured) || isLoading}
            onPress={() => onContinue({ pin, biometricsEnabled })} // Passing updated pin
          >
            {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => onContinue({ pin: '0000', biometricsEnabled: false })} // Skip uses default pin
            disabled={isLoading}
          >
            <Text style={[styles.textButtonText, { color: theme.text, opacity: 0.6 }]}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

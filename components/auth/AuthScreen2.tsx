import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { styles } from './styles';
import { ScreenProps } from './types';

type AuthScreen2Props = ScreenProps & {
  errorMessage?: string | null;
  isLoading?: boolean;
  onInputChange?: () => void;
  secondaryLabel?: string;
};

export const AuthScreen2 = ({
  onContinue,
  onSecondary,
  errorMessage,
  isLoading,
  onInputChange,
  secondaryLabel = 'Continue as Guest',
}: AuthScreen2Props) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [input, setInput] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidPhone = (value: string) => /^\d{10}$/.test(value);
  const normalizedInput = input.trim();
  const isEmail = isValidEmail(normalizedInput);
  const isPhone = isValidPhone(normalizedInput);
  const isValid = isEmail || isPhone;
  const showValidationError = touched && normalizedInput.length > 0 && !isValid;
  const mergedErrorMessage =
    showValidationError && !localError
      ? 'Enter a valid 10-digit mobile number or email.'
      : localError || errorMessage || null;

  const handleInputChange = (value: string) => {
    setTouched(false);
    setLocalError(null);
    onInputChange?.();
    setInput(value);
  };

  const handleContinue = () => {
    setTouched(true);
    if (!isValid) {
      setLocalError('Enter a valid 10-digit mobile number or email.');
      return;
    }
    onContinue(isPhone ? normalizedInput : normalizedInput.toLowerCase());
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.topSection}>
            <View style={styles.imageContainer}>
              <View style={styles.glowCircle} />
              <View style={[styles.mainCircle, { borderColor: theme.border }]}>
                <View style={[styles.iconBox, { backgroundColor: '#FFCCBC' }]}>
                  <MaterialCommunityIcons name="lock" size={30} color="#E64A19" />
                </View>
                <View style={[styles.smallIcon, styles.pos1, { backgroundColor: '#BBDEFB' }]}>
                  <MaterialCommunityIcons name="account-group" size={12} color="#1976D2" />
                </View>
                <View style={[styles.smallIcon, styles.pos2, { backgroundColor: '#FFF9C4' }]}>
                  <MaterialCommunityIcons name="database" size={12} color="#FBC02D" />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.textSection}>
            <Text style={[styles.title, { color: theme.text }]}>Sign in to save your progress</Text>
            <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6 }]}>
              Sync your data securely across devices.
            </Text>
          </View>

          <View style={styles.formSection}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.border, color: theme.text }]}
              placeholder="Email address or mobile number"
              placeholderTextColor={theme.text + '66'}
              value={input}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={handleInputChange}
              onBlur={() => setTouched(true)}
            />
            {mergedErrorMessage ? (
              <View style={styles.smartErrorContainer}>
                <View style={styles.errorIconBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#D32F2F" />
                </View>
                <Text style={styles.smartErrorText} numberOfLines={2}>
                  {mergedErrorMessage}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, opacity: isValid && !isLoading ? 1 : 0.6 },
              ]}
              disabled={!isValid || !!isLoading}
              onPress={handleContinue}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.textButton} onPress={() => onSecondary?.()}>
              <Text style={[styles.textButtonText, { color: theme.text, opacity: 0.6 }]}>
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

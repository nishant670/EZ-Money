import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';
import { ScreenProps } from './types';

type AuthScreen3Props = ScreenProps & {
  errorMessage?: string | null;
  isLoading?: boolean;
};

export const AuthScreen3 = ({
  onContinue,
  onSecondary,
  errorMessage,
  isLoading,
}: AuthScreen3Props) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <ScrollView
      contentContainerStyle={[styles.authScrollContent, { flexGrow: 1, justifyContent: 'center' }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topSection}>
        <View style={styles.imageContainer}>
          <View style={styles.glowCircle} />
          <View style={[styles.mainCircle, { borderColor: theme.border }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FFE0B2' }]}>
              <MaterialCommunityIcons name="account" size={30} color="#E65100" />
            </View>
            <View style={[styles.smallIcon, styles.pos1, { backgroundColor: '#ECEFF1' }]}>
              <MaterialCommunityIcons name="cellphone" size={12} color="#455A64" />
            </View>
            <View style={[styles.smallIcon, styles.pos2, { backgroundColor: '#E1BEE7' }]}>
              <MaterialCommunityIcons name="cloud-upload" size={12} color="#9C27B0" />
            </View>
            <View style={[styles.smallIcon, styles.pos3, { backgroundColor: '#C8E6C9' }]}>
              <MaterialCommunityIcons name="lock" size={12} color="#43A047" />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.textSection}>
        <Text style={[styles.title, { color: theme.text }]}>You’re using Finnri as a guest</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={[styles.infoCard, { backgroundColor: 'white' }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#FFCCBC' }]}>
            <MaterialCommunityIcons name="cellphone" size={20} color="#E64A19" />
          </View>
          <Text style={[styles.infoText, { color: theme.text }]}>
            Data is stored only on this device
          </Text>
        </View>
        <View style={[styles.infoCard, { backgroundColor: 'white', marginTop: 12 }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#D1C4E9' }]}>
            <MaterialCommunityIcons name="cloud-upload" size={20} color="#5E35B1" />
          </View>
          <Text style={[styles.infoText, { color: theme.text }]}>
            You can sign in anytime to back up your data
          </Text>
        </View>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: isLoading ? 0.6 : 1 },
          ]}
          disabled={!!isLoading}
          onPress={() => onContinue()}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="white"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
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
        <TouchableOpacity style={styles.textButton} onPress={() => onSecondary?.()}>
          <Text style={[styles.textButtonText, { color: theme.text, opacity: 0.6 }]}>
            Sign in now
          </Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
};

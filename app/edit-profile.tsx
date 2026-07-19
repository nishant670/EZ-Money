import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/navigation/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { AnimatedBottomSheet } from '@/components/ui/AnimatedBottomSheet';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { updateProfile, authOtpSend, authOtpVerify } from '@/lib/auth';

const TText = cssInterop(ThemedText, { className: 'style' });

export default function EditProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user, token, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const avatarSource = user?.profile_photo_uri
    ? { uri: user.profile_photo_uri }
    : require('@/assets/images/finnri_avatar.png');

  // OTP State
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingIdentifier, setVerifyingIdentifier] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const cardColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
  const backgroundColor = colorScheme === 'light' ? '#F9F7FB' : theme.background;

  const handleChangePhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Photo not selected', 'Please choose an image file to use as your profile photo.');
        return;
      }

      if (!FileSystem.documentDirectory) {
        updateUser({ profile_photo_uri: asset.uri });
        return;
      }

      const profileDir = `${FileSystem.documentDirectory}profile/`;
      const extension = (asset.name?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const photoUri = `${profileDir}avatar-${user?.uuid ?? 'local'}-${Date.now()}.${extension}`;
      await FileSystem.makeDirectoryAsync(profileDir, { intermediates: true });
      await FileSystem.copyAsync({ from: asset.uri, to: photoUri });

      const previousPhoto = user?.profile_photo_uri;
      updateUser({ profile_photo_uri: photoUri });
      if (previousPhoto?.startsWith(profileDir) && previousPhoto !== photoUri) {
        await FileSystem.deleteAsync(previousPhoto, { idempotent: true });
      }
    } catch {
      Alert.alert('Photo not updated', 'Unable to select that image right now.');
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    if (!token) return;

    const emailChanged = (user?.email || '') !== email.trim();
    const phoneChanged = (user?.phone || '') !== phone.trim();

    if (emailChanged && phoneChanged) {
      Alert.alert('Notice', 'Please update Email and Phone separately for security.');
      return;
    }

    if (emailChanged && email.trim() !== '') {
      setVerifyingIdentifier(email.trim());
      triggerOtp(email.trim());
      return;
    }

    if (phoneChanged && phone.trim() !== '') {
      setVerifyingIdentifier(phone.trim());
      triggerOtp(phone.trim());
      return;
    }

    // Proceed without OTP if only name changed or fields cleared (if allowed)
    performUpdate();
  };

  const triggerOtp = async (identifier: string) => {
    setIsLoading(true);
    try {
      await authOtpSend(identifier);
      setShowOtp(true);
    } catch {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length < 4) {
      Alert.alert('Error', 'Please enter a valid OTP.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await authOtpVerify(verifyingIdentifier, otpCode);
      setShowOtp(false);
      setOtpCode('');
      performUpdate(res.claim_token);
    } catch {
      Alert.alert('Error', 'Invalid OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const performUpdate = async (claimToken?: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await updateProfile({
        token,
        username: name,
        email: email.trim(),
        phone: phone.trim(),
        claim_token: claimToken,
      });
      updateUser(result.user);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      // Handle specific errors
      const msg = error instanceof Error ? error.message : 'Failed to update profile.';
      if (msg.includes('Username is already taken')) {
        Alert.alert('Username Taken', 'This username is already in use. Please choose another.');
      } else if (msg.includes('verification required')) {
        Alert.alert('Verification Required', msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView className="flex-1" style={{ backgroundColor }}>
        <AppHeader title="Edit Profile" onBack={() => router.back()} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            {/* Avatar Section */}
            <View className="items-center mt-6 mb-8">
              <View className="relative">
                <View className="w-36 h-36 rounded-full border-4 border-white overflow-hidden shadow-md">
                  <Image
                    source={avatarSource}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                <Pressable
                  onPress={() => void handleChangePhoto()}
                  className="absolute bottom-1 right-1 w-10 h-10 rounded-full border-2 border-white items-center justify-center shadow-lg"
                  style={{ backgroundColor: theme.accent }}>
                  <MaterialCommunityIcons name="camera" size={20} color="white" />
                </Pressable>
              </View>
              <Pressable className="mt-4" onPress={() => void handleChangePhoto()}>
                <TText
                  className="text-sm font-bold tracking-widest"
                  style={{ color: theme.accent, fontFamily: Fonts.body }}>
                  CHANGE PHOTO
                </TText>
              </Pressable>
            </View>

            {/* Form Fields */}
            <View className="gap-6">
              {/* Name */}
              <View>
                <TText
                  className="text-xs font-bold opacity-60 mb-2 ml-4 uppercase"
                  style={{ fontFamily: Fonts.body }}>
                  What should I call you?
                </TText>
                <View
                  className="flex-row items-center px-4 h-16 rounded-[28px] shadow-sm"
                  style={{ backgroundColor: cardColor }}>
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#F3E5F5' }}>
                    <MaterialCommunityIcons name="account-outline" size={22} color="#7B1FA2" />
                  </View>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    style={{ flex: 1, fontFamily: Fonts.body, fontSize: 14, color: theme.text }}
                  />
                </View>
              </View>

              {/* Email */}
              <View>
                <TText
                  className="text-xs font-bold opacity-60 mb-2 ml-4 uppercase"
                  style={{ fontFamily: Fonts.body }}>
                  Email Address
                </TText>
                <View
                  className="flex-row items-center px-4 h-16 rounded-[28px] shadow-sm"
                  style={{ backgroundColor: cardColor }}>
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#FFEBEE' }}>
                    <MaterialCommunityIcons name="email-outline" size={22} color="#D32F2F" />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    style={{ flex: 1, fontFamily: Fonts.body, fontSize: 14, color: theme.text }}
                  />
                </View>
              </View>

              {/* Mobile */}
              <View>
                <TText
                  className="text-xs font-bold opacity-60 mb-2 ml-4 uppercase"
                  style={{ fontFamily: Fonts.body }}>
                  Mobile Number
                </TText>
                <View
                  className="flex-row items-center px-4 h-16 rounded-[28px] shadow-sm"
                  style={{ backgroundColor: cardColor }}>
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#FFF3E0' }}>
                    <MaterialCommunityIcons name="phone-outline" size={22} color="#EF6C00" />
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter your mobile number"
                    keyboardType="phone-pad"
                    style={{ flex: 1, fontFamily: Fonts.body, fontSize: 14, color: theme.text }}
                  />
                </View>
              </View>
            </View>

            {/* Info Callout */}
            <View
              className="flex-row p-5 rounded-[28px] mt-8 items-center"
              style={{ backgroundColor: theme.secondary }}>
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: '#9575CD' }}>
                <MaterialCommunityIcons name="information-variant" size={20} color="white" />
              </View>
              <Text
                className="flex-1 text-xs leading-relaxed opacity-70"
                style={{ fontFamily: Fonts.body, color: theme.text }}>
                Updating your profile helps me personalize your financial insights and keeps your
                account super secure!
              </Text>
            </View>

            {/* Update Button */}
            <Pressable
              onPress={handleUpdate}
              disabled={isLoading}
              className={`flex-row items-center justify-center h-18 rounded-[32px] mt-10 shadow-lg p-4 ${isLoading ? 'opacity-70' : ''}`}
              style={{ backgroundColor: theme.accent }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={24}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                  <TText
                    className="text-base font-black text-white"
                    style={{ fontFamily: Fonts.title }}>
                    Update My Profile
                  </TText>
                </>
              )}
            </Pressable>

            {/* Footer Text */}
            <TText
              className="text-center text-[10px] font-bold tracking-widest opacity-30 mt-6 uppercase"
              style={{ fontFamily: Fonts.body }}>
              CHANGES TAKE EFFECT IMMEDIATELY
            </TText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* OTP Modal */}
      <AnimatedBottomSheet visible={showOtp} onClose={() => setShowOtp(false)}>
          <View className="bg-white rounded-t-[32px] p-8 pb-12 items-center">
            <View className="w-12 h-1 rounded-full bg-gray-300 mb-6" />
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: '#E3F2FD' }}>
              <MaterialCommunityIcons name="shield-check" size={32} color="#2196F3" />
            </View>
            <TText
              className="text-lg font-bold mb-2 text-center"
              style={{ fontFamily: Fonts.title }}>
              {"Verify It's You"}
            </TText>
            <TText className="text-center opacity-60 mb-8" style={{ fontFamily: Fonts.body }}>
              We sent a code to {verifyingIdentifier}.{'\n'}Enter it below to confirm this change.
            </TText>

            <TextInput
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="1234"
              keyboardType="number-pad"
              maxLength={6}
              className="w-full h-16 rounded-2xl bg-gray-50 text-center text-2xl font-bold tracking-widest mb-6 border border-gray-100"
              style={{ fontFamily: Fonts.title, color: theme.text }}
              autoFocus
            />

            <Pressable
              onPress={verifyOtp}
              disabled={isVerifying}
              className="w-full h-14 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: '#2196F3' }}>
              {isVerifying ? (
                <ActivityIndicator color="white" />
              ) : (
                <TText
                  className="text-white font-bold text-base"
                  style={{ fontFamily: Fonts.title }}>
                  Verify & Update
                </TText>
              )}
            </Pressable>

            <Pressable onPress={() => setShowOtp(false)} className="p-2">
              <TText className="opacity-50 text-sm" style={{ fontFamily: Fonts.body }}>
                Cancel
              </TText>
            </Pressable>
          </View>
      </AnimatedBottomSheet>
    </>
  );
}

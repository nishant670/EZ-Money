import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TText = cssInterop(ThemedText, { className: 'style' });

export default function SecurityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const backgroundColor = colorScheme === 'light' ? '#FDFBFF' : theme.background;
  const cardColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';

  const toggleLock = () => updateUser({ has_pin: !user?.has_pin });
  const toggleBiometrics = () => updateUser({ biometrics_enabled: !user?.biometrics_enabled });
  const toggleStealthMode = () => updateUser({ stealth_mode: !user?.stealth_mode });

  const activeSessions = [
    {
      id: '1',
      device: 'iPhone 15 Pro',
      location: 'London, UK',
      status: 'Current',
      time: 'Active now',
      icon: 'cellphone',
    },
    {
      id: '2',
      device: 'MacBook Air',
      location: 'London, UK',
      status: '',
      time: '2 days ago',
      icon: 'laptop',
    },
  ];

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1A1A1A" />
        </Pressable>
        <TText
          className="text-base font-black"
          style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
          Keep it Safe
        </TText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 items-center mt-6">
          {/* Shield Illustration */}
          <View
            className="w-28 h-28 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: '#E0F2F1' }}>
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#26A69A' }}>
              <MaterialCommunityIcons name="shield-check" size={24} color="white" />
            </View>
          </View>

          <TText
            className="text-2xl font-black mb-2"
            style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
            Security & Privacy
          </TText>
          <TText
            className="text-sm opacity-50 font-medium"
            style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
            {"You're in control of your data adventure!"}
          </TText>
        </View>

        <View className="px-6 mt-10 gap-8">
          {/* APP ACCESS Section */}
          <View>
            <TText
              className="text-xs font-black tracking-widest opacity-40 mb-4 px-2"
              style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
              APP ACCESS
            </TText>
            <View
              className="rounded-[32px] overflow-hidden"
              style={{
                backgroundColor: cardColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 2,
              }}>
              <View
                className="flex-row items-center p-5 justify-between border-b"
                style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: theme.secondary }}>
                    <MaterialCommunityIcons name="lock-outline" size={22} color={theme.accent} />
                  </View>
                  <View>
                    <TText
                      className="text-base font-black"
                      style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                      Enable Lock
                    </TText>
                    <TText
                      className="text-xs opacity-50 font-medium"
                      style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
                      Require PIN to open Finnri
                    </TText>
                  </View>
                </View>
                <Switch
                  value={!!user?.has_pin}
                  onValueChange={toggleLock}
                  trackColor={{ false: '#E0E0E0', true: theme.accent }}
                  thumbColor="white"
                />
              </View>

              <Pressable
                onPress={() => router.push('/change-pin')}
                className="flex-row items-center p-5 justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: '#F3E5F5' }}>
                    <MaterialCommunityIcons name="dots-horizontal" size={22} color="#7B1FA2" />
                  </View>
                  <View>
                    <TText
                      className="text-base font-black"
                      style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                      Change PIN
                    </TText>
                    <TText
                      className="text-xs opacity-50 font-medium"
                      style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
                      Update your 4-digit code
                    </TText>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
              </Pressable>
            </View>
          </View>

          {/* BIOMETRICS Section */}
          <View>
            <TText
              className="text-xs font-black tracking-widest opacity-40 mb-4 px-2"
              style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
              BIOMETRICS
            </TText>
            <View
              className="rounded-[32px] flex-row items-center p-5 justify-between"
              style={{
                backgroundColor: cardColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 2,
              }}>
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: '#E1F5FE' }}>
                  <MaterialCommunityIcons name="face-recognition" size={22} color="#0288D1" />
                </View>
                <View>
                  <TText
                    className="text-base font-black"
                    style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                    Unlock with Face ID
                  </TText>
                  <TText
                    className="text-xs opacity-50 font-medium"
                    style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
                    Quick and secure access
                  </TText>
                </View>
              </View>
              <Switch
                value={!!user?.biometrics_enabled}
                onValueChange={toggleBiometrics}
                trackColor={{ false: '#E0E0E0', true: theme.accent }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* PRIVACY Section */}
          <View>
            <TText
              className="text-xs font-black tracking-widest opacity-40 mb-4 px-2"
              style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
              PRIVACY
            </TText>
            <View
              className="rounded-[32px] flex-row items-center p-5 justify-between"
              style={{
                backgroundColor: cardColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 2,
              }}>
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: '#FFF9C4' }}>
                  <MaterialCommunityIcons name="eye-off-outline" size={22} color="#FBC02D" />
                </View>
                <View>
                  <TText
                    className="text-base font-black"
                    style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                    Stealth Mode
                  </TText>
                  <TText
                    className="text-xs opacity-50 font-medium"
                    style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
                    Hide balances on home screen
                  </TText>
                </View>
              </View>
              <Switch
                value={!!user?.stealth_mode}
                onValueChange={toggleStealthMode}
                trackColor={{ false: '#E0E0E0', true: theme.accent }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* ACTIVE SESSIONS Section */}
          <View>
            <TText
              className="text-xs font-black tracking-widest opacity-40 mb-4 px-2"
              style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
              ACTIVE SESSIONS
            </TText>
            <View className="gap-4">
              {activeSessions.map((session) => (
                <View
                  key={session.id}
                  className="rounded-[32px] flex-row items-center p-5"
                  style={{
                    backgroundColor: cardColor,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.03,
                    shadowRadius: 10,
                    elevation: 2,
                  }}>
                  <View
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: '#F5F5F5' }}>
                    <MaterialCommunityIcons name={session.icon as any} size={22} color="#757575" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <TText
                        className="text-sm font-black mr-2"
                        style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                        {session.device}
                      </TText>
                      {session.status === 'Current' && (
                        <View className="bg-emerald-100 px-2 py-0.5 rounded-md">
                          <TText className="text-[10px] font-black text-emerald-600 uppercase">
                            CURRENT
                          </TText>
                        </View>
                      )}
                    </View>
                    <TText
                      className="text-xs opacity-50 font-medium"
                      style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
                      {session.location} • {session.time}
                    </TText>
                  </View>
                  <Pressable hitSlop={15}>
                    <MaterialCommunityIcons name="close-circle" size={24} color={theme.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Footer */}
        <TText
          className="text-center text-[10px] font-black tracking-widest opacity-20 mt-16 uppercase px-10"
          style={{ fontFamily: Fonts.body, color: '#1A1A1A' }}>
          YOUR PRIVACY IS OUR PRIORITY
        </TText>
      </ScrollView>

      {/* Basic Tab Bar Mockup to match screenshot if needed, but router will handle navigation */}
    </SafeAreaView>
  );
}

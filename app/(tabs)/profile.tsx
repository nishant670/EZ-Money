import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

const TText = cssInterop(ThemedText, { className: 'style' });

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [smartSorting, setSmartSorting] = useState(true);

  const handleLogout = () => {
    clearAuth();
    router.replace('/onboarding');
  };
  const isGuest = !!user?.is_guest;

  const backgroundColor = colorScheme === 'light' ? '#F9F7FB' : theme.background;
  const cardColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
  const borderColor = colorScheme === 'light' ? 'rgba(0,0,0,0.05)' : '#2E2E2E';

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View style={{ width: 24 }} />
        <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
          Your Playbook
        </TText>
        <Pressable onPress={() => router.push('/app-mood')} hitSlop={20}>
          <MaterialCommunityIcons name="magic-staff" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 gap-6">
          {/* Finnri Profile Card */}
          <View
            className="rounded-[40px] items-center py-10 overflow-hidden"
            style={{
              backgroundColor: cardColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}>
            <View
              className="absolute top-0 left-0 right-0 h-24"
              style={{ backgroundColor: '#FFF5F2', opacity: 0.5 }}
            />

            <View className="relative">
              <View className="w-28 h-28 rounded-full border-4 border-white overflow-hidden shadow-sm">
                <Image
                  source={require('@/assets/images/finnri_avatar.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <View
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-2 border-white items-center justify-center"
                style={{ backgroundColor: '#FF8A65' }}>
                <MaterialCommunityIcons name="robot" size={14} color="white" />
              </View>
            </View>

            <TText
              className="text-xl mt-4 font-bold text-center px-4"
              style={{ fontFamily: Fonts.title }}>
              {user?.username || 'Guest User'}
            </TText>
            <TText className="text-sm italic opacity-60 mb-1" style={{ fontFamily: Fonts.body }}>
              {user?.email || 'No email linked'}
            </TText>
            <TText className="text-sm italic opacity-60 mb-6" style={{ fontFamily: Fonts.body }}>
              {user?.phone || 'No phone linked'}
            </TText>

            <Pressable
              onPress={() => router.push('/edit-profile')}
              className="flex-row items-center px-8 py-3 rounded-full"
              style={{ backgroundColor: '#F0EAF5' }}>
              <MaterialCommunityIcons
                name="pencil"
                size={18}
                color="#4A148C"
                style={{ marginRight: 8 }}
              />
              <TText
                className="font-bold text-sm"
                style={{ color: '#4A148C', fontFamily: Fonts.title }}>
                Edit My Profile
              </TText>
            </Pressable>
          </View>

          {/* Features Grid */}
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {/* Sync My World */}
            <View className="w-[48%] p-5 rounded-[32px]" style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#E1F5FE' }}>
                <MaterialCommunityIcons name="sync" size={20} color="#0288D1" />
              </View>
              <TText
                className="text-base font-bold leading-tight"
                style={{ fontFamily: Fonts.title }}>
                Sync My World
              </TText>
              <TText className="text-xs opacity-50 mt-1" style={{ fontFamily: Fonts.body }}>
                Backup & Keep{'\n'}Everything Updated
              </TText>
            </View>

            {/* Keep it Safe */}
            <Pressable
              onPress={() => router.push('/security')}
              className="w-[48%] p-5 rounded-[32px]"
              style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#E8F5E9' }}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#388E3C" />
              </View>
              <TText
                className="text-base font-bold leading-tight"
                style={{ fontFamily: Fonts.title }}>
                Keep it Safe
              </TText>
              <TText className="text-xs opacity-50 mt-1" style={{ fontFamily: Fonts.body }}>
                Security & Privacy{'\n'}Control
              </TText>
            </Pressable>
          </View>

          {/* Smart Sorting */}
          <View
            className="p-6 rounded-[32px] flex-row items-center justify-between"
            style={{ backgroundColor: cardColor }}>
            <View className="flex-1 mr-4">
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                  style={{ backgroundColor: '#FFEBEE' }}>
                  <MaterialCommunityIcons name="creation" size={20} color="#D32F2F" />
                </View>
                <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
                  Smart Sorting
                </TText>
              </View>
              <TText className="text-xs opacity-50" style={{ fontFamily: Fonts.body }}>
                Let AI Auto-Categorize Your Spending
              </TText>
            </View>
            <Switch
              value={smartSorting}
              onValueChange={setSmartSorting}
              trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
              thumbColor="white"
            />
          </View>

          {/* Business Section Info */}
          <View className="mt-4">
            <TText
              className="text-xs tracking-widest font-bold opacity-40 mb-4 ml-2"
              style={{ fontFamily: Fonts.body }}>
              THE FINNRI CIRCLE
            </TText>

            <View
              className="bg-white rounded-[32px] overflow-hidden"
              style={{ backgroundColor: cardColor }}>
              <Pressable className="flex-row items-center p-5 border-b" style={{ borderColor }}>
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: '#FFF3E0' }}>
                  <MaterialCommunityIcons name="information" size={20} color="#EF6C00" />
                </View>
                <View className="flex-1">
                  <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
                    About Finnri
                  </TText>
                  <TText className="text-xs opacity-50" style={{ fontFamily: Fonts.body }}>
                    Our Story & Values
                  </TText>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.text}
                  style={{ opacity: 0.3 }}
                />
              </Pressable>

              <Pressable className="flex-row items-center p-5">
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: '#F3E5F5' }}>
                  <MaterialCommunityIcons name="help-circle" size={20} color="#7B1FA2" />
                </View>
                <View className="flex-1">
                  <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
                    Help & Support
                  </TText>
                  <TText className="text-xs opacity-50" style={{ fontFamily: Fonts.body }}>
                    Get Answers & Talk to Us
                  </TText>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.text}
                  style={{ opacity: 0.3 }}
                />
              </Pressable>
            </View>
          </View>

          {/* Account action */}
          <Pressable
            onPress={() => {
              if (isGuest) {
                router.push('/auth?mode=link');
                return;
              }
              handleLogout();
            }}
            className="flex-row items-center justify-center h-16 rounded-[24px] mt-2 mb-2"
            style={{ backgroundColor: isGuest ? '#F0EAF5' : '#FFF5F2' }}>
            <MaterialCommunityIcons
              name={isGuest ? 'login' : 'logout'}
              size={20}
              color={isGuest ? '#4A148C' : '#D32F2F'}
              style={{ marginRight: 10 }}
            />
            <TText
              className="text-base font-bold"
              style={{ color: isGuest ? '#4A148C' : '#D32F2F', fontFamily: Fonts.title }}>
              {isGuest ? 'Sign in / Create account' : 'Time to Log Out?'}
            </TText>
          </Pressable>

          {/* Footer */}
          <TText
            className="text-center text-[10px] tracking-widest opacity-30 mt-2 mb-4 uppercase"
            style={{ fontFamily: Fonts.body }}>
            FINNRI PLAYBOOK V3.1.2 • HANDMADE WITH LOVE
          </TText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

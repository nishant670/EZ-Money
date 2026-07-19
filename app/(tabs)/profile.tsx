import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Image, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, getMoodIconName } from '@/constants/theme';
import { useAppSettingsStore } from '@/hooks/use-app-settings-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

const TText = cssInterop(ThemedText, { className: 'style' });

export default function ProfileScreen() {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const isDark = theme.mode === 'dark';
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.replace('/auth');
  };
  const isGuest = !!user?.is_guest;

  const backgroundColor = colors.background;
  const cardColor = colors.card;
  const borderColor = isDark ? colors.border : 'rgba(0,0,0,0.05)';
  const iconStyle = theme.mood.iconStyle;
  const { smartSorting, setSmartSorting } = useAppSettingsStore();
  const avatarSource = user?.profile_photo_uri
    ? { uri: user.profile_photo_uri }
    : require('@/assets/images/finnri_avatar.png');

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View style={{ width: 24 }} />
        <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
          Your Playbook
        </TText>
        <Pressable onPress={() => router.push('/app-mood')} hitSlop={20}>
          <MaterialCommunityIcons name="magic-staff" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 gap-6">
          <View className="items-center py-2">
            <View className="relative">
              <View className="w-28 h-28 rounded-full border-4 border-white overflow-hidden shadow-sm">
                <Image
                  source={avatarSource}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <View
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-2 border-white items-center justify-center"
                style={{ backgroundColor: colors.accent }}>
                <MaterialCommunityIcons
                  name={getMoodIconName('robot', iconStyle, true) as any}
                  size={14}
                  color="white"
                />
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
              style={{ backgroundColor: colors.secondary }}>
              <MaterialCommunityIcons
                name={getMoodIconName('pencil', iconStyle) as any}
                size={18}
                color={colors.accent}
                style={{ marginRight: 8 }}
              />
              <TText
                className="font-bold text-sm"
                style={{ color: colors.accent, fontFamily: Fonts.title }}>
                Edit My Profile
              </TText>
            </Pressable>
          </View>

          {/* Features Grid */}
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {/* Tools */}
            <Pressable
              onPress={() => router.push('/tools')}
              className="w-[48%] p-5 rounded-[32px]"
              style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#E1F5FE' }}>
                <MaterialCommunityIcons
                  name={getMoodIconName('toolbox', iconStyle) as any}
                  size={20}
                  color="#0288D1"
                />
              </View>
              <TText
                className="text-base font-bold leading-tight"
                style={{ fontFamily: Fonts.title }}>
                Tools
              </TText>
              <TText className="text-xs opacity-50 mt-1" style={{ fontFamily: Fonts.body }}>
                SIP & EMI{'\n'}Calculators
              </TText>
            </Pressable>

            {/* Keep it Safe */}
            <Pressable
              onPress={() => router.push('/security')}
              className="w-[48%] p-5 rounded-[32px]"
              style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#E8F5E9' }}>
                <MaterialCommunityIcons
                  name={getMoodIconName('shield-check', iconStyle) as any}
                  size={20}
                  color="#388E3C"
                />
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

            <Pressable
              onPress={() => router.push('/budgets')}
              className="w-[48%] p-5 rounded-[32px]"
              style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#E0F2F1' }}>
                <MaterialCommunityIcons name="chart-donut" size={20} color="#00796B" />
              </View>
              <TText
                className="text-base font-bold leading-tight"
                style={{ fontFamily: Fonts.title }}>
                Budget Watch
              </TText>
              <TText className="text-xs opacity-50 mt-1" style={{ fontFamily: Fonts.body }}>
                Monthly Limits{'\n'}& In-App Alerts
              </TText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/subscriptions')}
              className="w-[48%] p-5 rounded-[32px]"
              style={{ backgroundColor: cardColor }}>
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: '#EDE7F6' }}>
                <MaterialCommunityIcons name="calendar-sync-outline" size={20} color="#5E35B1" />
              </View>
              <TText
                className="text-base font-bold leading-tight"
                style={{ fontFamily: Fonts.title }}>
                Subscriptions
              </TText>
              <TText className="text-xs opacity-50 mt-1" style={{ fontFamily: Fonts.body }}>
                Bills, Apps{'\n'}& Renewal Dates
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
                  style={{ backgroundColor: colors.secondary }}>
                  <MaterialCommunityIcons name="creation" size={20} color={colors.accent} />
                </View>
                <TText className="text-base font-bold" style={{ fontFamily: Fonts.title }}>
                  Smart Sorting
                </TText>
              </View>
              <TText className="text-xs opacity-50" style={{ fontFamily: Fonts.body }}>
                Auto-apply AI category, tag, and payment suggestions
              </TText>
            </View>
            <Switch
              value={smartSorting}
              onValueChange={setSmartSorting}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
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
              <Pressable
                onPress={() => router.push('/about-finnri')}
                className="flex-row items-center p-5 border-b"
                style={{ borderColor }}>
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: '#FFF3E0' }}>
                  <MaterialCommunityIcons
                    name={getMoodIconName('information', iconStyle) as any}
                    size={20}
                    color="#EF6C00"
                  />
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
                  color={colors.text}
                  style={{ opacity: 0.3 }}
                />
              </Pressable>

              <Pressable onPress={() => router.push('/help-support')} className="flex-row items-center p-5">
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: '#F3E5F5' }}>
                  <MaterialCommunityIcons
                    name={getMoodIconName('help-circle', iconStyle) as any}
                    size={20}
                    color="#7B1FA2"
                  />
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
                  color={colors.text}
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
            style={{ backgroundColor: isGuest ? colors.secondary : '#FFF5F2' }}>
            <MaterialCommunityIcons
              name={getMoodIconName(isGuest ? 'login' : 'logout', iconStyle) as any}
              size={20}
              color={isGuest ? colors.accent : '#D32F2F'}
              style={{ marginRight: 10 }}
            />
            <TText
              className="text-base font-bold"
              style={{ color: isGuest ? colors.accent : '#D32F2F', fontFamily: Fonts.title }}>
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

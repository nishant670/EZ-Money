import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TText = cssInterop(ThemedText, { className: 'style' });

const themeColors = [
  { id: 'lavender', color: '#F0EAF5', accent: '#FF8A65' },
  { id: 'mint', color: '#D8F0E8', accent: '#66D1A6' },
  { id: 'peach', color: '#F8DAD6', accent: '#FF9E8A' },
  { id: 'sky', color: '#DCEFF7', accent: '#73C4E2' },
] as const;

type IconStyle = 'whimsical' | 'minimal';

export default function AppMoodScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [selectedTheme, setSelectedTheme] =
    useState<(typeof themeColors)[number]['id']>('lavender');
  const [nightMode, setNightMode] = useState(false);
  const [iconStyle, setIconStyle] = useState<IconStyle>('whimsical');

  const backgroundColor = colorScheme === 'light' ? '#F9F0F8' : theme.background;
  const cardColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
  const mutedText = colorScheme === 'light' ? '#9BA1AE' : '#9CA3AF';
  const selected = themeColors.find((option) => option.id === selectedTheme) ?? themeColors[0];

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable onPress={goBack} hitSlop={20}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1D2738" />
        </Pressable>
        <TText
          className="text-base font-black"
          style={{ color: '#111827', fontFamily: Fonts.title }}>
          App Mood
        </TText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 120 }}>
        <TText
          className="text-xs font-black tracking-widest mb-4"
          style={{ color: mutedText, fontFamily: Fonts.body }}>
          LIVE PREVIEW
        </TText>

        <View
          className="rounded-[32px] px-6 py-6 mb-9"
          style={{
            backgroundColor: cardColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.03,
            shadowRadius: 12,
            elevation: 2,
          }}>
          <View className="flex-row items-start justify-between mb-7">
            <View>
              <View className="h-3 w-24 rounded-full bg-gray-100 mb-3" />
              <View className="h-6 w-36 rounded-full" style={{ backgroundColor: '#FFEAE0' }} />
            </View>
            <View className="h-9 w-9 rounded-full" style={{ backgroundColor: '#FAD7D3' }} />
          </View>

          {[
            { icon: 'cash', color: '#FF8A65', bg: '#F3E5F5' },
            { icon: 'piggy-bank-outline', color: '#14B884', bg: '#DDF7EF' },
          ].map((item, index) => (
            <View
              key={item.icon}
              className={index === 0 ? 'flex-row items-center mb-5' : 'flex-row items-center'}>
              <View
                className="h-11 w-11 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: item.bg }}>
                <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View className="flex-1">
                <View className="h-2.5 rounded-full bg-gray-50 mb-3" />
                <View className="h-2.5 w-3/4 rounded-full bg-gray-50" />
              </View>
            </View>
          ))}
        </View>

        <TText
          className="text-xs font-black tracking-widest mb-5"
          style={{ color: mutedText, fontFamily: Fonts.body }}>
          THEME COLOR
        </TText>
        <View className="flex-row items-center justify-between mb-4">
          {themeColors.map((option) => {
            const active = option.id === selectedTheme;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedTheme(option.id)}
                className="h-16 w-16 rounded-full items-center justify-center"
                style={{
                  borderColor: active ? option.accent : 'transparent',
                  borderWidth: 2,
                }}>
                <View
                  className="h-12 w-12 rounded-full items-center justify-center border-4 border-white"
                  style={{ backgroundColor: option.color }}>
                  {active && (
                    <View
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: option.accent }}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        <TText className="text-sm italic mb-9" style={{ color: '#606775', fontFamily: Fonts.body }}>
          {'"Lavender is my current favorite, but you do you!"'}
        </TText>

        <View
          className="rounded-[32px] flex-row items-center justify-between px-6 py-6 mb-9"
          style={{
            backgroundColor: cardColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.03,
            shadowRadius: 12,
            elevation: 2,
          }}>
          <View className="flex-row items-center flex-1">
            <View
              className="h-12 w-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: '#EEF1FF' }}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={24} color="#6675FF" />
            </View>
            <View>
              <TText
                className="text-lg font-black"
                style={{ color: '#111827', fontFamily: Fonts.title }}>
                Night Owl Mode
              </TText>
              <TText
                className="text-xs font-medium"
                style={{ color: '#667085', fontFamily: Fonts.body }}>
                Easier on the eyes at night
              </TText>
            </View>
          </View>
          <Switch
            value={nightMode}
            onValueChange={setNightMode}
            trackColor={{ false: '#E0E7F0', true: selected.accent }}
            thumbColor="white"
          />
        </View>

        <TText
          className="text-xs font-black tracking-widest mb-5"
          style={{ color: mutedText, fontFamily: Fonts.body }}>
          ICON STYLE
        </TText>
        <View className="flex-row gap-4">
          <IconStyleOption
            active={iconStyle === 'whimsical'}
            label="Whimsical"
            icon="emoticon-happy-outline"
            onPress={() => setIconStyle('whimsical')}
          />
          <IconStyleOption
            active={iconStyle === 'minimal'}
            label="Minimal"
            icon="circle-outline"
            onPress={() => setIconStyle('minimal')}
          />
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center justify-around px-2 pt-4"
        style={{ height: 96, backgroundColor: '#FFF2EC' }}>
        {[
          { label: 'Home', icon: 'home-outline', route: '/(tabs)' },
          { label: 'Insights', icon: 'chart-bar', route: '/(tabs)/insight' },
          { label: 'Pot', icon: 'piggy-bank-outline', route: '/(tabs)/accounts' },
          {
            label: 'Playbook',
            icon: 'account-box-outline',
            route: '/(tabs)/profile',
            active: true,
          },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.replace(item.route as any)}
            className="items-center justify-start flex-1">
            <MaterialCommunityIcons
              name={item.icon as any}
              size={23}
              color={item.active ? '#FF8A65' : '#9BA1AE'}
            />
            <TText
              className="text-[10px] font-black mt-1"
              style={{
                color: item.active ? '#FF8A65' : '#9BA1AE',
                fontFamily: Fonts.body,
              }}>
              {item.label}
            </TText>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function IconStyleOption({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 h-36 rounded-[32px] items-center justify-center"
      style={{
        backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.38)',
        borderColor: active ? '#FF8A65' : 'transparent',
        borderWidth: 2,
      }}>
      <View
        className="h-12 w-12 rounded-full items-center justify-center mb-5"
        style={{ backgroundColor: active ? '#FFF0EC' : '#ECEFF3' }}>
        <MaterialCommunityIcons name={icon} size={28} color={active ? '#FF8A65' : '#98A2B3'} />
      </View>
      <TText
        className="text-base font-black"
        style={{ color: active ? '#111827' : '#6B7280', fontFamily: Fonts.title }}>
        {label}
      </TText>
      {active && (
        <TText
          className="text-[10px] font-black mt-2"
          style={{ color: '#FF8A65', fontFamily: Fonts.body }}>
          ACTIVE
        </TText>
      )}
    </Pressable>
  );
}

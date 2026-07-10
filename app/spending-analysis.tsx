import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import React from 'react';
import { ScrollView, TouchableOpacity, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CURRENCY_SYMBOL } from '@/constants/Currency';

const { width } = Dimensions.get('window');

export default function SpendingAnalysisScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 rounded-full bg-gray-50 items-center justify-center">
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText className="text-base font-black" style={{ color: theme.text }}>
          Detailed Analysis
        </ThemedText>
        <TouchableOpacity className="h-10 w-10 rounded-full bg-gray-50 items-center justify-center">
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Summary Header */}
        <View className="items-center mt-4">
          <TouchableOpacity className="bg-orange-50 dark:bg-orange-900/10 px-4 py-2 rounded-full mb-3 flex-row items-center">
            <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>
              Oct 2023
            </ThemedText>
            <MaterialCommunityIcons
              name="chevron-down"
              size={14}
              color={theme.accent}
              className="ml-1"
            />
          </TouchableOpacity>
          <ThemedText className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            Total Spending
          </ThemedText>
          <ThemedText className="text-3xl font-black" style={{ color: theme.text }}>
            {CURRENCY_SYMBOL}52,400
          </ThemedText>
        </View>

        {/* Daily Trend Card */}
        <View className="mx-6 mt-8 bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
          <ThemedText className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            Daily Trend
          </ThemedText>
          <View className="flex-row justify-between items-center mb-6">
            <ThemedText className="text-lg font-black" style={{ color: theme.text }}>
              Daily Fluctuations
            </ThemedText>
            <View className="bg-orange-50 dark:bg-orange-900/10 px-2 py-1 rounded-lg">
              <ThemedText className="text-[9px] font-black" style={{ color: theme.accent }}>
                Avg {CURRENCY_SYMBOL}1,690/day
              </ThemedText>
            </View>
          </View>

          {/* Chart Mockup */}
          <View className="h-32 w-full justify-end mb-4 overflow-hidden">
            {/* Placeholder for line chart - using bar chart as simpler mockup */}
            <View className="flex-row items-end justify-between h-full px-2">
              {[40, 60, 45, 80, 55, 70, 50].map((h, i) => (
                <View key={i} className="items-center">
                  <View
                    style={{
                      height: h,
                      width: (width - 100) / 7 - 10,
                      backgroundColor: theme.accent,
                      borderRadius: 8,
                      opacity: 0.1 + i / 10,
                    }}
                  />
                  <ThemedText className="text-[8px] text-gray-400 mt-2">Oct {i * 5 + 1}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row justify-between items-center pt-4 border-t border-gray-50 dark:border-gray-700">
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
              <ThemedText className="text-[11px] font-bold">
                {"Today's Spend: "}
                {CURRENCY_SYMBOL}2,100
              </ThemedText>
            </View>
            <ThemedText className="text-[10px] font-bold text-red-400">
              8% Higher than Avg
            </ThemedText>
          </View>
        </View>

        {/* By Category */}
        <View className="mx-6 mt-8">
          <ThemedText className="text-base font-black mb-4" style={{ color: theme.text }}>
            By Category
          </ThemedText>
          <View className="bg-white dark:bg-gray-800 rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-700">
            <CategoryItem
              icon="food"
              name="Food & Dining"
              percent="28% of total"
              amount="14,600"
              barWidth="28%"
              barColor="#F87171"
              theme={theme}
            />
            <CategoryItem
              icon="shopping"
              name="Shopping"
              percent="23% of total"
              amount="12,200"
              barWidth="23%"
              barColor={theme.accent}
              theme={theme}
            />
            <CategoryItem
              icon="car"
              name="Transport"
              percent="15% of total"
              amount="7,850"
              barWidth="15%"
              barColor="#FBBF24"
              theme={theme}
            />
            <CategoryItem
              icon="lightning-bolt"
              name="Utilities"
              percent="10% of total"
              amount="5,240"
              barWidth="10%"
              barColor="#60A5FA"
              theme={theme}
              isLast
            />
          </View>
        </View>

        {/* Top Merchants */}
        <View className="mx-6 mt-8">
          <ThemedText className="text-base font-black mb-4" style={{ color: theme.text }}>
            Top Merchants
          </ThemedText>
          <View className="bg-white dark:bg-gray-800 rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-700">
            <MerchantItem
              name="Amazon"
              txns="12 transactions"
              amount="8,450"
              initials="AMZ"
              theme={theme}
            />
            <MerchantItem
              name="Uber"
              txns="8 transactions"
              amount="4,200"
              initials="UBR"
              theme={theme}
            />
            <MerchantItem
              name="Zomato"
              txns="15 transactions"
              amount="3,920"
              initials="ZMT"
              theme={theme}
              isLast
            />
          </View>
        </View>

        {/* Behavioral Insights */}
        <View className="mx-6 mt-8">
          <ThemedText className="text-base font-black mb-4" style={{ color: theme.text }}>
            Behavioral Insights
          </ThemedText>
          <View className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-[32px] mb-4 flex-row items-center border border-orange-100/50">
            <View className="h-12 w-12 rounded-2xl bg-white dark:bg-gray-800 items-center justify-center mr-4">
              <MaterialCommunityIcons name="sofa-outline" size={24} color={theme.accent} />
            </View>
            <View className="flex-1">
              <ThemedText className="text-sm font-black mb-1" style={{ color: theme.accent }}>
                Weekend Peak
              </ThemedText>
              <ThemedText className="text-xs text-gray-500 leading-4">
                Your weekend spending is{' '}
                <ThemedText className="text-xs font-black">20% higher</ThemedText> than weekdays.
                Most of it goes to Entertainment.
              </ThemedText>
            </View>
          </View>

          <View className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[32px] flex-row items-center border border-red-100/50">
            <View className="h-12 w-12 rounded-2xl bg-white dark:bg-gray-800 items-center justify-center mr-4">
              <MaterialCommunityIcons name="alarm" size={24} color="#F87171" />
            </View>
            <View className="flex-1">
              <ThemedText className="text-sm font-black mb-1" style={{ color: '#F87171' }}>
                Late Night Activity
              </ThemedText>
              <ThemedText className="text-xs text-gray-500 leading-4">
                You tend to order food after 10 PM on Tuesdays. This month it cost you{' '}
                <ThemedText className="text-xs font-black">{CURRENCY_SYMBOL}1,850</ThemedText>.
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer Button */}
      <View className="absolute bottom-10 left-6 right-6">
        <TouchableOpacity
          className="flex-row items-center justify-center py-4 rounded-2xl shadow-lg"
          style={{ backgroundColor: theme.accent }}>
          <MaterialCommunityIcons name="file-chart" size={20} color="white" />
          <ThemedText className="text-white font-black ml-2">Generate Weekly Report</ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CategoryItem({ icon, name, percent, amount, barWidth, barColor, theme, isLast }: any) {
  return (
    <TouchableOpacity
      className={`flex-row items-center p-5 ${!isLast ? 'border-b border-gray-50 dark:border-gray-700' : ''}`}>
      <View
        className="h-10 w-10 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: `${barColor}15` }}>
        <MaterialCommunityIcons name={icon} size={20} color={barColor} />
      </View>
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-1">
          <View>
            <ThemedText className="text-sm font-bold">{name}</ThemedText>
            <ThemedText className="text-[10px] text-gray-400">{percent}</ThemedText>
          </View>
          <View className="items-end">
            <ThemedText className="text-sm font-black">
              {CURRENCY_SYMBOL}
              {amount}
            </ThemedText>
            <View className="h-1 w-12 bg-gray-50 dark:bg-gray-700 rounded-full mt-1">
              <View
                className="h-full rounded-full"
                style={{ width: barWidth, backgroundColor: barColor }}
              />
            </View>
          </View>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" className="ml-2" />
    </TouchableOpacity>
  );
}

function MerchantItem({ name, txns, amount, initials, theme, isLast }: any) {
  return (
    <View
      className={`flex-row items-center p-5 ${!isLast ? 'border-b border-gray-50 dark:border-gray-700' : ''}`}>
      <View className="h-10 w-10 rounded-full bg-gray-50 dark:bg-gray-700 items-center justify-center mr-4">
        <ThemedText className="text-[10px] font-black text-gray-400">{initials}</ThemedText>
      </View>
      <View className="flex-1">
        <ThemedText className="text-sm font-bold">{name}</ThemedText>
        <ThemedText className="text-[10px] text-gray-400">{txns}</ThemedText>
      </View>
      <ThemedText className="text-sm font-black">
        {CURRENCY_SYMBOL}
        {amount}
      </ThemedText>
    </View>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import { useAuthStore } from '@/hooks/use-auth-store';
import { fetchInsights, InsightsResponse } from '@/lib/insights';

export default function InsightScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const { token, user } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [insights, setInsights] = useState<InsightsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = async (isRefreshing = false) => {
        if (!token) return;
        if (!isRefreshing) setLoading(true);
        setError(null);
        try {
            const data = await fetchInsights(token);
            setInsights(data);
        } catch (err: any) {
            console.error('Failed to fetch insights:', err);
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    if (loading && !refreshing) {
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    if (error && !insights) {
        return (
            <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: theme.background }}>
                <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.text} style={{ opacity: 0.5 }} />
                <ThemedText className="text-lg font-bold mt-4 text-center">{error}</ThemedText>
                <TouchableOpacity
                    className="mt-6 px-8 py-3 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                    onPress={() => loadData()}
                >
                    <ThemedText className="text-white font-bold">Retry</ThemedText>
                </TouchableOpacity>
            </View>
        );
    }

    if (!insights) {
        return (
            <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: theme.background }}>
                <ThemedText>No data available yet. Add some transactions!</ThemedText>
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 py-4">
                    <View>
                        <ThemedText className="text-xs text-gray-400 font-medium">FINANCIAL INSIGHTS</ThemedText>
                        <ThemedText className="text-2xl font-black" style={{ color: theme.text }}>Portfolio Analysis</ThemedText>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/security')}
                        className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
                    >
                        <MaterialCommunityIcons name="cog-outline" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Monthly Health Section */}
                <MonthlyHealthSection health={insights.monthly_health} theme={theme} />

                {/* AI Insights Section */}
                <AIInsightsSection insights={insights.ai_insights} theme={theme} />

                {/* Categories & Merchants Section */}
                <SpendingAnalysisSection
                    categories={insights.category_breakdown}
                    merchants={insights.top_merchants}
                    theme={theme}
                />

                {/* Account Intelligence Section */}
                <AccountIntelligenceSection
                    spending={insights.account_spending}
                    utilization={insights.credit_utilization}
                    theme={theme}
                />

                {/* Behavioral Trends Section */}
                <BehavioralTrendsSection trends={insights.behavioral_insights} theme={theme} />

                {/* Review Actions Section */}
                <ReviewActionsSection items={insights.review_items} theme={theme} />

            </ScrollView>
        </SafeAreaView>
    );
}

// Sub-components will be implemented next
function MonthlyHealthSection({ health, theme }: { health: InsightsResponse['monthly_health'], theme: any }) {
    return (
        <View className="mx-6 mt-4 p-6 rounded-[32px] bg-white dark:bg-gray-800 shadow-sm">
            <View className="flex-row justify-between items-center mb-6">
                <ThemedText className="font-bold text-gray-500 uppercase tracking-wider text-xs">Financial Health</ThemedText>
                <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 items-center">
                    <ThemedText className="text-[10px] font-bold mr-1">THIS MONTH</ThemedText>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={theme.text} />
                </View>
            </View>

            <View className="flex-row justify-between mb-8">
                <View className="flex-1">
                    <ThemedText className="text-xs text-gray-400 mb-1">Net Savings</ThemedText>
                    <ThemedText className="text-2xl font-black" style={{ color: theme.text }}>
                        {CURRENCY_SYMBOL}{health.savings.toLocaleString()}
                    </ThemedText>
                </View>
                <View className="items-end">
                    <View className="h-14 w-14 rounded-full border-4 border-gray-100 items-center justify-center relative">
                        <View
                            className="absolute h-14 w-14 rounded-full border-4 items-center justify-center"
                            style={{
                                borderColor: theme.accent,
                                borderTopColor: 'transparent',
                                transform: [{ rotate: `${(health.savings_rate / 100) * 360}deg` }]
                            }}
                        />
                        <ThemedText className="text-[10px] font-black">{Math.round(health.savings_rate)}%</ThemedText>
                    </View>
                    <ThemedText className="text-[10px] text-gray-400 mt-1 font-bold">SAVINGS RATE</ThemedText>
                </View>
            </View>

            <View className="gap-4">
                <View>
                    <View className="flex-row justify-between mb-1">
                        <ThemedText className="text-xs text-gray-400">Income vs Spent</ThemedText>
                        <ThemedText className="text-xs font-bold">{CURRENCY_SYMBOL}{health.income.toLocaleString()}</ThemedText>
                    </View>
                    <View className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex-row">
                        <View
                            className="h-full bg-green-400"
                            style={{ width: `${Math.min(100, (health.income / (health.income + health.spent)) * 100)}%` }}
                        />
                        <View
                            className="h-full bg-red-400"
                            style={{ width: `${Math.min(100, (health.spent / (health.income + health.spent)) * 100)}%` }}
                        />
                    </View>
                </View>
            </View>

            <View className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-orange-100 items-center justify-center">
                    <MaterialCommunityIcons name="fire" size={20} color={theme.accent} />
                </View>
                <View className="flex-1">
                    <ThemedText className="text-xs font-bold text-gray-400">BURN RATE INSIGHT</ThemedText>
                    <ThemedText className="text-xs font-medium leading-4 mt-0.5">{health.burn_rate}</ThemedText>
                </View>
            </View>
        </View>
    );
}

function AIInsightsSection({ insights, theme }: { insights: InsightsResponse['ai_insights'], theme: any }) {
    if (insights.length === 0) return null;
    if (insights?.length === 0) return null;

    return (
        <View className="mt-8">
            <ThemedText className="mx-6 text-lg font-black mb-4">Smart Alerts</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
                {insights?.map((card, idx) => (
                    <View
                        key={idx}
                        className="w-72 p-5 rounded-[32px] border"
                        style={{
                            backgroundColor: card.type === 'warning' ? '#FFF5F5' : card.type === 'success' ? '#F2FFF9' : '#F5F9FF',
                            borderColor: card.type === 'warning' ? '#FFE0E0' : card.type === 'success' ? '#E0FFE0' : '#E0F0FF'
                        }}
                    >
                        <View className="flex-row items-center gap-2 mb-2">
                            <View className="h-6 w-6 rounded-full bg-white items-center justify-center">
                                <MaterialCommunityIcons
                                    name={card.type === 'warning' ? 'alert-octagon' : card.type === 'success' ? 'check-circle' : 'information'}
                                    size={14}
                                    color={card.type === 'warning' ? '#E53E3E' : card.type === 'success' ? '#38A169' : theme.accent}
                                />
                            </View>
                            <ThemedText className="text-xs font-black uppercase tracking-widest" style={{ opacity: 0.6 }}>Finnri AI</ThemedText>
                        </View>
                        <ThemedText className="text-sm font-bold mb-1 leading-5">{card.title}</ThemedText>
                        <ThemedText className="text-xs text-gray-500 leading-4 mb-4">{card.description}</ThemedText>
                        <TouchableOpacity className="self-start px-4 py-2 rounded-full bg-white shadow-sm">
                            <ThemedText className="text-[10px] font-black">{card.action_label}</ThemedText>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

function SpendingAnalysisSection({ categories, merchants, theme }: { categories: InsightsResponse['category_breakdown'], merchants: InsightsResponse['top_merchants'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <ThemedText className="text-lg font-black mb-4">Where Your Money Went</ThemedText>

            <View className="flex-row gap-4 mb-4">
                <View className="flex-1 bg-white dark:bg-gray-800 p-5 rounded-[32px] shadow-sm">
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-4">Categories</ThemedText>
                    {categories?.slice(0, 4).map((cat, idx) => (
                        <View key={idx} className="mb-3">
                            <View className="flex-row justify-between mb-1">
                                <ThemedText className="text-[11px] font-bold">{cat.category}</ThemedText>
                                <ThemedText className="text-[10px] text-gray-400">{Math.round(cat.percentage)}%</ThemedText>
                            </View>
                            <View className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                                <View className="h-full bg-orange-400 rounded-full" style={{ width: `${cat.percentage}%` }} />
                            </View>
                        </View>
                    )) ?? <ThemedText className="text-[10px] text-gray-400">No category data</ThemedText>}
                    <TouchableOpacity className="mt-2 items-center">
                        <ThemedText className="text-[10px] font-black text-orange-400">VIEW ALL</ThemedText>
                    </TouchableOpacity>
                </View>

                <View className="flex-1 bg-white dark:bg-gray-800 p-5 rounded-[32px] shadow-sm">
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-4">Top Merchants</ThemedText>
                    {merchants?.map((m, idx) => (
                        <View key={idx} className="flex-row items-center gap-3 mb-3">
                            <View className="h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-700 items-center justify-center">
                                <MaterialCommunityIcons name="storefront-outline" size={16} color={theme.text} />
                            </View>
                            <View className="flex-1">
                                <ThemedText className="text-[11px] font-bold" numberOfLines={1}>{m.merchant}</ThemedText>
                                <ThemedText className="text-[9px] text-gray-400">{m.transaction_count} txns</ThemedText>
                            </View>
                            <ThemedText className="text-[10px] font-black">{CURRENCY_SYMBOL}{Math.round(m.amount)}</ThemedText>
                        </View>
                    )) ?? <ThemedText className="text-[10px] text-gray-400">No merchant data</ThemedText>}
                </View>
            </View>
        </View>
    );
}

function AccountIntelligenceSection({ spending, utilization, theme }: { spending: InsightsResponse['account_spending'], utilization: InsightsResponse['credit_utilization'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <ThemedText className="text-lg font-black mb-4">Account Intelligence</ThemedText>

            <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm mb-4">
                <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-6">Spending Source Breakdown</ThemedText>
                <View className="flex-row items-end justify-between h-32 px-4">
                    {spending?.map((s, idx) => (
                        <View key={idx} className="items-center w-12">
                            <ThemedText className="text-[9px] font-black mb-1">{Math.round(s.percentage)}%</ThemedText>
                            <View
                                className="w-full bg-orange-100 dark:bg-orange-900/30 rounded-t-xl rounded-b-md"
                                style={{ height: `${s.percentage}%`, minHeight: 4 }}
                            >
                                <View className="absolute bottom-0 w-full bg-orange-400 rounded-lg" style={{ height: '30%' }} />
                            </View>
                            <ThemedText className="text-[9px] font-bold text-gray-400 mt-2 uppercase">{s.type}</ThemedText>
                        </View>
                    ))}
                </View>
            </View>

            {utilization?.map((card, idx) => (
                <View key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-transparent mb-3"
                    style={card.warning ? { borderColor: '#FFE0E0' } : {}}>
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-3">
                            <View className="h-10 w-10 rounded-2xl bg-indigo-50 items-center justify-center">
                                <MaterialCommunityIcons name="credit-card-outline" size={20} color="#5A67D8" />
                            </View>
                            <View>
                                <ThemedText className="text-[13px] font-bold">{card.account_name}</ThemedText>
                                <ThemedText className="text-[10px] text-gray-400">Credit Card • Due in {card.due_date} days</ThemedText>
                            </View>
                        </View>
                        <View className="items-end">
                            <ThemedText className={`text-xs font-black ${card.warning ? 'text-red-500' : 'text-gray-400'}`}>
                                {Math.round(card.percentage)}%
                            </ThemedText>
                            <ThemedText className="text-[8px] font-bold uppercase">Used</ThemedText>
                        </View>
                    </View>
                    <View className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <View className={`h-full ${card.warning ? 'bg-red-400' : 'bg-indigo-400'}`} style={{ width: `${card.percentage}%` }} />
                    </View>
                    {card.warning && (
                        <View className="flex-row items-center gap-2 mt-3">
                            <MaterialCommunityIcons name="alert-circle" size={14} color="#E53E3E" />
                            <ThemedText className="text-[10px] font-bold text-red-500">High utilization alert! Try to keep it below 60%.</ThemedText>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

function BehavioralTrendsSection({ trends, theme }: { trends: InsightsResponse['behavioral_insights'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <ThemedText className="text-lg font-black mb-4">Habits & Trends</ThemedText>
            <View className="flex-row gap-4">
                <View className="flex-1 bg-white dark:bg-gray-800 p-5 rounded-[32px] shadow-sm">
                    <View className="h-10 w-10 rounded-2xl bg-yellow-50 items-center justify-center mb-3">
                        <MaterialCommunityIcons name="calendar-star" size={20} color="#D69E2E" />
                    </View>
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase">Peak Spend Day</ThemedText>
                    <ThemedText className="text-lg font-black mt-1">{trends.highest_spend_day}</ThemedText>
                    <ThemedText className="text-[10px] text-gray-500 mt-1 leading-4">You tend to spend most on this day of the week.</ThemedText>
                </View>

                <View className="flex-1 bg-white dark:bg-gray-800 p-5 rounded-[32px] shadow-sm">
                    <View className="h-10 w-10 rounded-2xl bg-blue-50 items-center justify-center mb-3">
                        <MaterialCommunityIcons name="chart-line-variant" size={20} color="#3182CE" />
                    </View>
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase">Daily Burn</ThemedText>
                    <ThemedText className="text-lg font-black mt-1">{CURRENCY_SYMBOL}{Math.round(trends.average_daily_spend)}</ThemedText>
                    <ThemedText className="text-[10px] text-gray-500 mt-1 leading-4">Your average daily spend across all categories.</ThemedText>
                </View>
            </View>
        </View>
    );
}

function ReviewActionsSection({ items, theme }: { items: InsightsResponse['review_items'], theme: any }) {
    if (items.length === 0) return null;

    return (
        <View className="mx-6 mt-12 mb-10">
            <View className="bg-orange-500 p-8 rounded-[40px] shadow-lg shadow-orange-300">
                <View className="flex-row justify-between items-start mb-6">
                    <View>
                        <ThemedText className="text-white text-2xl font-black">Needs Review</ThemedText>
                        <ThemedText className="text-white/80 text-sm mt-1">Found {items.reduce((acc, i) => acc + i.count, 0)} items that need your attention.</ThemedText>
                    </View>
                    <View className="h-12 w-12 rounded-2xl bg-white/20 items-center justify-center">
                        <MaterialCommunityIcons name="broom" size={24} color="white" />
                    </View>
                </View>

                <View className="gap-3">
                    {items?.map((item, idx) => (
                        <TouchableOpacity key={idx} className="flex-row items-center justify-between bg-white/10 p-4 rounded-2xl">
                            <View className="flex-row items-center gap-3">
                                <View className="h-8 w-8 rounded-full bg-white/20 items-center justify-center">
                                    <ThemedText className="text-white text-xs font-black">{item.count}</ThemedText>
                                </View>
                                <ThemedText className="text-white text-sm font-bold">{item.title}</ThemedText>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="white" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity className="mt-8 bg-white py-4 rounded-3xl items-center">
                    <ThemedText className="text-orange-500 font-black">START CLEANUP</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

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
import { PeriodPicker, DateRange } from '@/components/insights/PeriodPicker';

export default function InsightScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const { token, user } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [insights, setInsights] = useState<InsightsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [currentRange, setCurrentRange] = useState<DateRange>({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(),
        label: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        preset: 'this_month'
    });

    const loadData = async (isRefreshing = false) => {
        if (!token) return;
        if (!isRefreshing) setLoading(true);
        setError(null);
        try {
            const startDate = currentRange.start ? currentRange.start.toISOString().split('T')[0] : undefined;
            const endDate = currentRange.end ? currentRange.end.toISOString().split('T')[0] : undefined;
            const data = await fetchInsights(token, startDate, endDate);
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
    }, [token, currentRange]);

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
            <View className="flex-row items-center justify-between px-6 py-4">
                <View>
                    <ThemedText className="text-2xl font-black" style={{ color: theme.text }}>Intelligence</ThemedText>
                    <TouchableOpacity className="flex-row items-center mt-1" onPress={() => setPickerVisible(true)}>
                        <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>{currentRange.label}</ThemedText>
                        <MaterialCommunityIcons name="chevron-down" size={14} color={theme.accent} />
                    </TouchableOpacity>
                </View>
                <View className="flex-row gap-4">
                    <TouchableOpacity className="h-10 w-10 rounded-full bg-gray-50 items-center justify-center">
                        <MaterialCommunityIcons name="magnify" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity className="h-10 w-10 rounded-full bg-gray-50 items-center justify-center">
                        <MaterialCommunityIcons name="filter-variant" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                }
            >
                {/* Monthly Health Section */}
                <MonthlyHealthSection health={insights.monthly_health} theme={theme} />

                {/* Spending Analysis Section */}
                <SpendingAnalysisSection
                    categories={insights.category_breakdown}
                    merchants={insights.top_merchants}
                    theme={theme}
                    router={router}
                />

                {/* AI Insights Section / Smart Alerts */}
                <SmartAlertsSection insights={insights.ai_insights} theme={theme} />

                {/* Account Intelligence Section */}
                <AccountIntelligenceSection
                    spending={insights.account_spending}
                    utilization={insights.credit_utilization}
                    theme={theme}
                />

                {/* Stats Cards Row */}
                <StatsCardsSection trends={insights.behavioral_insights} theme={theme} />

                {/* Needs Review Section */}
                <NeedsReviewSection items={insights.review_items} theme={theme} />

            </ScrollView>

            <PeriodPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onSelect={setCurrentRange}
                currentRange={currentRange}
            />
        </SafeAreaView>
    );
}

// Sub-components
function MonthlyHealthSection({ health, theme }: { health: InsightsResponse['monthly_health'], theme: any }) {
    return (
        <View className="mx-6 mt-4 p-6 rounded-[32px] bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Financial Health</ThemedText>
                    <ThemedText className="text-2xl font-black" style={{ color: theme.text }}>Good Standing</ThemedText>
                </View>
                <View className="h-16 w-16 items-center justify-center">
                    {/* Progress Circle Mockup using Views */}
                    <View className="h-16 w-16 rounded-full border-[6px] border-gray-100 items-center justify-center relative">
                        <View className="absolute h-16 w-16 rounded-full border-[6px] border-orange-500" style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent', transform: [{ rotate: '45deg' }] }} />
                        <ThemedText className="text-xs font-black">70%</ThemedText>
                    </View>
                </View>
            </View>

            <View className="flex-row justify-between mb-8">
                <View className="flex-1">
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-2">Total Income</ThemedText>
                    <View className="flex-row items-center">
                        <View className="h-6 w-1 rounded-full bg-green-500 mr-3" />
                        <ThemedText className="text-xl font-black" style={{ color: theme.text }}>{CURRENCY_SYMBOL}85,000</ThemedText>
                    </View>
                </View>
                <View className="flex-1 pl-4">
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-2">Total Spent</ThemedText>
                    <View className="flex-row items-center">
                        <View className="h-6 w-1 rounded-full bg-red-400 mr-3" />
                        <ThemedText className="text-xl font-black" style={{ color: theme.text }}>{CURRENCY_SYMBOL}52,400</ThemedText>
                    </View>
                </View>
            </View>

            <View className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl flex-row items-center">
                <View className="h-8 w-8 rounded-full bg-orange-500 items-center justify-center mr-3">
                    <MaterialCommunityIcons name="clock-outline" size={16} color="white" />
                </View>
                <View className="flex-1">
                    <ThemedText className="text-[11px] font-bold" style={{ color: theme.accent }}>
                        Burn Rate: <ThemedText className="text-[11px] font-medium" style={{ color: theme.accent }}>At your current spending, your balance will last ~18 days.</ThemedText>
                    </ThemedText>
                </View>
            </View>
        </View>
    );
}

function SpendingAnalysisSection({ categories, merchants, theme, router }: { categories: InsightsResponse['category_breakdown'], merchants: InsightsResponse['top_merchants'], theme: any, router: any }) {
    return (
        <View className="mx-6 mt-8">
            <View className="flex-row justify-between items-center mb-4">
                <ThemedText className="text-lg font-black" style={{ color: theme.text }}>Spending Analysis</ThemedText>
                <TouchableOpacity onPress={() => router.push('/spending-analysis')}>
                    <ThemedText className="text-xs font-bold" style={{ color: theme.accent }}>Details</ThemedText>
                </TouchableOpacity>
            </View>

            <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <View className="flex-row items-center mb-8">
                    <View className="h-28 w-28 items-center justify-center relative">
                        <View className="h-28 w-28 rounded-full border-[10px] border-gray-50 dark:border-gray-700" />
                        <View className="absolute h-28 w-28 rounded-full border-[10px] border-red-400" style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderTopColor: 'transparent', transform: [{ rotate: '-30deg' }] }} />
                        <View className="absolute h-28 w-28 rounded-full border-[10px] border-orange-500" style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: '120deg' }] }} />
                        <View className="absolute items-center">
                            <ThemedText className="text-[8px] text-gray-400 font-bold uppercase">Food</ThemedText>
                            <ThemedText className="text-lg font-black">28%</ThemedText>
                        </View>
                    </View>

                    <View className="flex-1 ml-8 gap-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="h-2 w-2 rounded-full bg-red-400 mr-2" />
                                <ThemedText className="text-xs font-bold text-gray-500">Food & Dining</ThemedText>
                            </View>
                            <ThemedText className="text-xs font-black" style={{ color: theme.text }}>{CURRENCY_SYMBOL}14,600</ThemedText>
                        </View>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
                                <ThemedText className="text-xs font-bold text-gray-500">Shopping</ThemedText>
                            </View>
                            <ThemedText className="text-xs font-black" style={{ color: theme.text }}>{CURRENCY_SYMBOL}12,200</ThemedText>
                        </View>
                        <View className="flex-row items-center">
                            <MaterialCommunityIcons name="trending-up" size={14} color="#F87171" className="mr-1" />
                            <ThemedText className="text-[10px] font-bold text-red-400">12% higher than last month</ThemedText>
                        </View>
                    </View>
                </View>

                <View className="pt-6 border-t border-gray-50 dark:border-gray-700">
                    <ThemedText className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Top Merchants</ThemedText>
                    {merchants?.slice(0, 2).map((m, idx) => (
                        <View key={idx} className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className="h-10 w-10 rounded-2xl bg-gray-50 dark:bg-gray-700 items-center justify-center mr-4">
                                    <MaterialCommunityIcons name={idx === 0 ? "shopping" : "car"} size={20} color={theme.text} />
                                </View>
                                <ThemedText className="text-sm font-bold" style={{ color: theme.text }}>{m.merchant}</ThemedText>
                            </View>
                            <ThemedText className="text-sm font-black" style={{ color: theme.text }}>{CURRENCY_SYMBOL}{Math.round(m.amount).toLocaleString()}</ThemedText>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function SmartAlertsSection({ insights, theme }: { insights: InsightsResponse['ai_insights'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <ThemedText className="text-lg font-black mb-4" style={{ color: theme.text }}>Smart Alerts</ThemedText>
            <View className="gap-4">
                <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border-l-4 border-l-indigo-500 shadow-sm border border-gray-100 dark:border-gray-700">
                    <View className="flex-row items-start mb-4">
                        <View className="h-10 w-10 rounded-2xl bg-indigo-50 items-center justify-center mr-4">
                            <MaterialCommunityIcons name="star-four-points" size={20} color="#6366F1" />
                        </View>
                        <View className="flex-1">
                            <ThemedText className="text-sm font-black mb-1">Unusual Spending</ThemedText>
                            <ThemedText className="text-xs text-gray-500 leading-4">Uber spending is 42% higher than your weekly average.</ThemedText>
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                        <TouchableOpacity className="flex-1 bg-gray-50 dark:bg-gray-700 py-2 rounded-xl items-center">
                            <ThemedText className="text-[10px] font-black">View Details</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 bg-indigo-500 py-2 rounded-xl items-center" style={{ backgroundColor: '#6366F1' }}>
                            <ThemedText className="text-[10px] font-black text-white">Set Limit</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border-l-4 border-l-orange-500 shadow-sm border border-gray-100 dark:border-gray-700">
                    <View className="flex-row items-start mb-4">
                        <View className="h-10 w-10 rounded-2xl bg-orange-50 items-center justify-center mr-4">
                            <MaterialCommunityIcons name="calendar-clock" size={20} color="#F59E0B" />
                        </View>
                        <View className="flex-1">
                            <ThemedText className="text-sm font-black mb-1">Subscription Renewed</ThemedText>
                            <ThemedText className="text-xs text-gray-500 leading-4">Netflix renewed ({CURRENCY_SYMBOL}649). This is your 14th consecutive month.</ThemedText>
                        </View>
                    </View>
                    <TouchableOpacity className="self-start bg-gray-50 dark:bg-gray-700 px-6 py-2 rounded-xl items-center">
                        <ThemedText className="text-[10px] font-black">Manage</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function AccountIntelligenceSection({ spending, utilization, theme }: { spending: InsightsResponse['account_spending'], utilization: InsightsResponse['credit_utilization'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <ThemedText className="text-lg font-black mb-4" style={{ color: theme.text }}>Account Intelligence</ThemedText>
            <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-2">
                        <ThemedText className="text-sm font-bold">HDFC Savings</ThemedText>
                        <ThemedText className="text-[11px] text-gray-400">{CURRENCY_SYMBOL}14,200 spent</ThemedText>
                    </View>
                    <View className="h-2 bg-gray-50 dark:bg-gray-700 rounded-full overflow-hidden">
                        <View className="h-full rounded-full" style={{ backgroundColor: theme.accent, width: '45%' }} />
                    </View>
                </View>

                <View>
                    <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                            <ThemedText className="text-sm font-bold">ICICI Credit Card</ThemedText>
                            <View className="ml-2 bg-red-50 px-2 py-0.5 rounded-full">
                                <ThemedText className="text-[8px] font-black text-red-500 uppercase">High Utilization</ThemedText>
                            </View>
                        </View>
                        <ThemedText className="text-[10px] font-black text-red-500">74% of limit used</ThemedText>
                    </View>
                    <View className="h-2 bg-gray-50 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                        <View className="h-full bg-red-400 rounded-full" style={{ width: '74%' }} />
                    </View>
                    <View className="flex-row justify-end">
                        <ThemedText className="text-[10px] font-bold text-gray-400">{CURRENCY_SYMBOL}74,000 / {CURRENCY_SYMBOL}1,00,000</ThemedText>
                    </View>
                </View>
            </View>
        </View>
    );
}

function StatsCardsSection({ trends, theme }: { trends: InsightsResponse['behavioral_insights'], theme: any }) {
    return (
        <View className="mx-6 mt-8 flex-row gap-4">
            <View className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <View className="h-10 w-10 rounded-2xl bg-blue-50 items-center justify-center mb-4">
                    <MaterialCommunityIcons name="calendar-outline" size={20} color="#3B82F6" />
                </View>
                <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-1">Daily Average</ThemedText>
                <ThemedText className="text-lg font-black">{CURRENCY_SYMBOL}1,690</ThemedText>
            </View>

            <View className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center mb-4">
                    <MaterialCommunityIcons name="chart-bar" size={20} color="#EF4444" />
                </View>
                <ThemedText className="text-[10px] font-black text-gray-400 uppercase mb-1">Busiest Day</ThemedText>
                <ThemedText className="text-lg font-black">Friday</ThemedText>
            </View>
        </View>
    );
}

function NeedsReviewSection({ items, theme }: { items: InsightsResponse['review_items'], theme: any }) {
    return (
        <View className="mx-6 mt-8">
            <View className="flex-row justify-between items-center mb-4">
                <ThemedText className="text-lg font-black" style={{ color: theme.text }}>Needs Review</ThemedText>
                <View className="bg-red-50 px-2 py-0.5 rounded-full">
                    <ThemedText className="text-[10px] font-black text-red-500">3 Items</ThemedText>
                </View>
            </View>

            <View className="bg-white dark:bg-gray-800 p-2 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <View className="p-4 flex-row items-center justify-between border-b border-gray-50 dark:border-gray-700">
                    <View className="flex-row items-center flex-1">
                        <View className="h-10 w-10 rounded-full bg-gray-50 dark:bg-gray-700 items-center justify-center mr-4">
                            <MaterialCommunityIcons name="help-circle-outline" size={20} color={theme.text} />
                        </View>
                        <View className="flex-1">
                            <ThemedText className="text-sm font-bold">Payment to Vendor</ThemedText>
                            <ThemedText className="text-[10px] text-gray-400">Uncategorized • Yesterday</ThemedText>
                        </View>
                    </View>
                    <View className="items-end">
                        <ThemedText className="text-sm font-black">{CURRENCY_SYMBOL}1,200</ThemedText>
                        <TouchableOpacity>
                            <ThemedText className="text-[10px] font-black" style={{ color: theme.accent }}>Assign</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <View className="h-10 w-10 rounded-full bg-gray-50 dark:bg-gray-700 items-center justify-center mr-4">
                            <MaterialCommunityIcons name="content-copy" size={20} color={theme.text} />
                        </View>
                        <View className="flex-1">
                            <ThemedText className="text-sm font-bold">Amazon India</ThemedText>
                            <ThemedText className="text-[10px] text-gray-400">Potential Duplicate • 2 Oct</ThemedText>
                        </View>
                    </View>
                    <View className="items-end">
                        <ThemedText className="text-sm font-black">{CURRENCY_SYMBOL}4,490</ThemedText>
                        <TouchableOpacity>
                            <ThemedText className="text-[10px] font-black" style={{ color: theme.accent }}>Resolve</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

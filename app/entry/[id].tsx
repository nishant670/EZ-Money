import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { CURRENCY_SYMBOL } from '@/constants/Currency';

export default function TransactionDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        id: string;
        name?: string;
        category?: string;
        amount?: string;
        entryType?: 'income' | 'expense';
        section?: string;
        mode?: string;
        notes?: string;
        merchant?: string;
        dateLabel?: string;
        tag?: string;
    }>();

    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const surfaceColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
    const cardBorder = theme.border;

    const entryType = params.entryType === 'income' ? 'income' : 'expense';
    const amountValue = Number(params.amount ?? 0);
    // Design uses black/dark text for amount, icon color varies. 
    // Let's stick to standard dark text for Hero amount unless specific color requested, but design shows black.

    const icon = entryType === 'income' ? 'cash-multiple' : 'coffee'; // Placeholder if no category icon logic
    const iconColor = theme.accent;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View className="flex-row items-center px-6 py-4">
                <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-800">
                    <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
                </Pressable>
                <ThemedText className="text-lg font-bold ml-4 flex-1 text-center pr-10" style={{ color: theme.text }}>
                    A Peek at Your Spend
                </ThemedText>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>

                {/* HERO SECTION */}
                <View className="items-center mb-8">
                    <View className="h-24 w-24 rounded-[30px] bg-white dark:bg-gray-800 items-center justify-center shadow-sm mb-4">
                        <MaterialCommunityIcons name={icon} size={48} color={iconColor} />
                    </View>
                    <ThemedText className="text-4xl font-black mb-1" style={{ color: theme.text }}>
                        {entryType === 'expense' ? '-' : '+'}{CURRENCY_SYMBOL}{amountValue.toFixed(2)}
                    </ThemedText>

                    <View className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1.5 shadow-sm mt-2">
                        <ThemedText className="text-sm font-bold mr-1">{params.merchant || params.name || 'Unknown'}</ThemedText>
                        <MaterialCommunityIcons name="check-decagram" size={14} color="#27AE60" />
                    </View>
                </View>

                {/* DETAILS CARD */}
                <View className="bg-white dark:bg-gray-800 rounded-[32px] p-6 shadow-sm mb-6">

                    {/* Date */}
                    <View className="flex-row gap-4 mb-6">
                        <View className="h-10 w-10 rounded-full bg-pink-50 items-center justify-center">
                            <MaterialCommunityIcons name="calendar" size={20} color={theme.accent} />
                        </View>
                        <View>
                            <ThemedText className="text-xs uppercase font-bold text-gray-400 mb-1">WHEN WAS THIS?</ThemedText>
                            <ThemedText className="text-base font-bold text-gray-800 dark:text-gray-100">
                                {params.dateLabel || 'Today'}
                            </ThemedText>
                            <ThemedText className="text-xs text-gray-500">
                                {/* Placeholder time */} 10:42 AM
                            </ThemedText>
                        </View>
                    </View>

                    {/* Category */}
                    <View className="flex-row gap-4 mb-6">
                        <View className="h-10 w-10 rounded-full bg-orange-50 items-center justify-center">
                            <MaterialCommunityIcons name="chart-pie" size={20} color={theme.accent} />
                        </View>
                        <View>
                            <ThemedText className="text-xs uppercase font-bold text-gray-400 mb-1">WHAT KIND OF SPEND?</ThemedText>
                            <ThemedText className="text-base font-bold text-gray-800 dark:text-gray-100">
                                {params.category}
                            </ThemedText>
                            <ThemedText className="text-xs text-gray-500">
                                Treat yourself category
                            </ThemedText>
                        </View>
                    </View>

                    {/* Notes */}
                    {params.notes && (
                        <View className="flex-row gap-4">
                            <View className="h-10 w-10 rounded-full bg-yellow-50 items-center justify-center">
                                <MaterialCommunityIcons name="pencil" size={20} color={theme.accent} />
                            </View>
                            <View className="flex-1">
                                <ThemedText className="text-xs uppercase font-bold text-gray-400 mb-1">YOUR NOTES</ThemedText>
                                <ThemedText className="text-base italic text-gray-600 dark:text-gray-300">
                                    "{params.notes}"
                                </ThemedText>
                            </View>
                        </View>
                    )}

                </View>

                {/* PAPER TRAIL */}
                <ThemedText className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 ml-4">THE PAPER TRAIL</ThemedText>
                <View className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[28px] p-4 flex-row items-center justify-between mb-8 bg-white/50">
                    <View className="flex-row items-center gap-4">
                        <View className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 items-center justify-center shadow-sm">
                            <MaterialCommunityIcons name="receipt" size={24} color="#A0A0A0" />
                        </View>
                        <View>
                            <ThemedText className="text-sm font-bold text-gray-700 dark:text-gray-200">Attach receipt</ThemedText>
                            <ThemedText className="text-xs text-gray-400">Snap a photo or upload file</ThemedText>
                        </View>
                    </View>
                    <MaterialCommunityIcons name="plus-circle" size={24} color="#D0D0D0" />
                </View>

                {/* ACTIONS */}
                <Pressable
                    className="w-full py-4 rounded-full items-center justify-center shadow-lg mb-4"
                    style={{ backgroundColor: theme.accent }}
                >
                    <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons name="tune" size={20} color="#FFF" />
                        <ThemedText className="text-white font-bold text-lg">Tweak this</ThemedText>
                    </View>
                </Pressable>

                <Pressable className="items-center py-2">
                    <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF6B6B" />
                        <ThemedText className="font-bold text-[#FF6B6B]">Forget this transaction</ThemedText>
                    </View>
                </Pressable>

            </ScrollView>
        </SafeAreaView>
    );
}

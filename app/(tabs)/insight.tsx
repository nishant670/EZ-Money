import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CURRENCY_SYMBOL } from '@/constants/Currency';


// Mock Data for Chart
const weeklyData = [
    { day: 'M', value: 0.3, active: false },
    { day: 'T', value: 0.5, active: false },
    { day: 'W', value: 0.8, active: true },
    { day: 'T', value: 0.2, active: false },
    { day: 'F', value: 0.4, active: false },
    { day: 'S', value: 0.6, active: false },
    { day: 'S', value: 0.5, active: false },
];

export default function InsightScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const accent = theme.accent;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Header */}
                <View className="flex-row items-center justify-between px-6 py-4">
                    <View className="flex-row items-center gap-3">
                        <View className="h-10 w-10 rounded-full bg-yellow-200 items-center justify-center border-2 border-white">
                            {/* Avatar Placeholder */}
                            <Image
                                source={{ uri: 'https://i.pravatar.cc/100?img=12' }}
                                className="h-full w-full rounded-full"
                                style={{ opacity: 0.8 }}
                            />
                            <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                        </View>
                        <View>
                            <ThemedText className="text-xs text-gray-500">Welcome back,</ThemedText>
                            <ThemedText className="text-sm font-bold" style={{ color: theme.text }}>Alex!</ThemedText>
                        </View>
                    </View>
                    <MaterialCommunityIcons name="bell" size={24} color={theme.text} style={{ opacity: 0.8 }} />
                </View>

                {/* Title Section */}
                <View className="items-center mt-4 mb-8 px-6">
                    <View className="bg-yellow-100 h-10 w-10 rounded-full items-center justify-center mb-2">
                        <MaterialCommunityIcons name="lightning-bolt" size={20} color="#F59E0B" />
                    </View>
                    <ThemedText className="text-3xl font-black text-center mb-2" style={{ color: theme.text }}>
                        Your Financial{'\n'}Superpowers!
                    </ThemedText>
                    <ThemedText className="text-center text-gray-500 px-6">
                        Here's the scoop on how you're mastering your money this month.
                    </ThemedText>
                </View>

                {/* Money Check-up Card */}
                <View className="mx-6 bg-white dark:bg-gray-800 rounded-[32px] p-6 shadow-sm mb-8">
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-row gap-3 flex-1 pr-4">
                            <MaterialCommunityIcons name="stethoscope" size={24} color={theme.accent} />
                            <ThemedText className="text-lg font-bold flex-1" style={{ color: theme.text }}>
                                Your Money Check-up
                            </ThemedText>
                        </View>
                        <View className="bg-green-100 px-3 py-1 rounded-full">
                            <ThemedText className="text-xs font-bold text-green-700 uppercase">HEALHTY</ThemedText>
                        </View>
                    </View>

                    <ThemedText className="text-gray-500 mb-1">Safe to spend this week</ThemedText>
                    <ThemedText className="text-4xl font-black mb-6" style={{ color: theme.text }}>
                        {CURRENCY_SYMBOL}245<ThemedText className="text-xl text-gray-400">.00</ThemedText>
                    </ThemedText>

                    <View className="flex-row justify-between mb-2">
                        <ThemedText className="text-xs text-gray-400">Spent: {CURRENCY_SYMBOL}1,250</ThemedText>
                        <ThemedText className="text-xs text-gray-400">Goal: {CURRENCY_SYMBOL}2,000</ThemedText>
                    </View>

                    {/* Progress Bar */}
                    <View className="h-3 bg-gray-100 rounded-full w-full overflow-hidden mb-4 flex-row">
                        <View className="h-full bg-yellow-400 w-[60%] rounded-full" />
                    </View>

                    <View className="flex-row items-center gap-2">
                        <TextEmoji>🎉</TextEmoji>
                        <ThemedText className="text-xs text-orange-400 font-medium">
                            You're doing amazing! Keeps you under budget.
                        </ThemedText>
                    </View>
                </View>

                {/* Spending Vibes */}
                <View className="mx-6 mb-8">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <ThemedText className="text-lg font-bold" style={{ color: theme.text }}>Spending Vibes</ThemedText>
                            <TextEmoji>🌊</TextEmoji>
                        </View>
                        <View className="flex-row items-center">
                            <ThemedText className="text-orange-400 font-bold mr-1">This Week</ThemedText>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={theme.text} />
                        </View>
                    </View>

                    <View className="bg-white dark:bg-gray-800 rounded-[32px] p-6 shadow-sm flex-row justify-between items-end h-48">
                        {weeklyData.map((d, i) => (
                            <View key={i} className="items-center gap-2 w-8">
                                <View className="w-full bg-gray-100 rounded-t-full rounded-b-lg overflow-hidden flex-col-reverse h-32 relative">
                                    <View
                                        style={{ height: `${d.value * 100}%` }}
                                        className={`w-full ${d.active ? 'bg-orange-400' : 'bg-orange-200'}`} // Simplified colors
                                    />
                                </View>
                                <ThemedText className="text-xs text-gray-400 font-bold">{d.day}</ThemedText>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Categories Grid */}
                <View className="mx-6 mb-8">
                    <View className="flex-row items-center gap-2 mb-4">
                        <ThemedText className="text-lg font-bold" style={{ color: theme.text }}>Where the magic happens</ThemedText>
                        <TextEmoji>✨</TextEmoji>
                    </View>

                    <View className="flex-row gap-4 mb-4">
                        <CategoryCard
                            label="TREATS"
                            amount="124"
                            icon="ice-cream"
                            iconColor="#F97316"
                            bg="#FFFAF0"
                        />
                        <CategoryCard
                            label="FUN STUFF"
                            amount="85"
                            icon="party-popper"
                            iconColor="#A855F7"
                            bg="#F3E8FF"
                        />
                    </View>
                    <View className="flex-row gap-4">
                        <CategoryCard
                            label="TRANSPORT"
                            amount="45"
                            icon="rocket-launch"
                            iconColor="#10B981"
                            bg="#ECFDF5"
                        />
                        <View className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-[24px] items-center justify-center p-4 h-32">
                            <View className="h-8 w-8 rounded-full bg-gray-400 items-center justify-center mb-2">
                                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                            </View>
                            <ThemedText className="text-xs text-gray-500 font-bold text-center">Add a new adventure</ThemedText>
                        </View>
                    </View>
                </View>

                {/* Smart Tip */}
                <View
                    className="mx-6 rounded-[32px] p-6 shadow-lg relative overflow-hidden"
                    style={{ backgroundColor: theme.accent }}
                >
                    {/* Gradient Overlay Mock */}
                    <View className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                    <View className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10" />

                    <View className="flex-row gap-4">
                        <View className="h-12 w-12 rounded-2xl bg-yellow-200 items-center justify-center">
                            <MaterialCommunityIcons name="star-face" size={24} color="#FFF" />
                        </View>
                        <View className="flex-1">
                            <ThemedText className="text-white font-bold text-lg mb-1">Smart Tip!</ThemedText>
                            <ThemedText className="text-white/90 text-sm leading-5">
                                Looks like you spent <ThemedText className="font-bold bg-white/20 px-1 rounded">20% less</ThemedText> on coffee
                                this week compared to last. That's almost enough for a movie ticket! 🎬
                            </ThemedText>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

// Simple Helper for Emoji text (since NativeWind might need text styling wrapper)
function TextEmoji({ children }: { children: string }) {
    return <ThemedText style={{ fontSize: 20 }}>{children}</ThemedText>;
}

function CategoryCard({ label, amount, icon, iconColor, bg }: any) {
    const theme = Colors.light; // Force light for these pastel cards or adjust logic
    return (
        <View className="flex-1 rounded-[24px] p-4 h-32 justify-between" style={{ backgroundColor: bg }}>
            <View className="h-8 w-8 rounded-full bg-white items-center justify-center shadow-sm">
                <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
            </View>
            <View>
                <ThemedText className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">{label}</ThemedText>
                <ThemedText className="text-xl font-black text-gray-800">{CURRENCY_SYMBOL}{amount}</ThemedText>
            </View>
        </View>
    )
}

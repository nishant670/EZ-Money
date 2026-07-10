import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Account } from '@/lib/accounts';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
    Dimensions,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface AdvancedFilterProps {
    onClose: () => void;
    onApply: (filters: {
        type: string;
        category: string | null;
        mode: string | null;
        account_id: number | null;
        min_amount: number;
        max_amount: number;
        start_date: string | null;
        end_date: string | null;
    }) => void;
    count?: number;
    currentFilters: {
        type: string;
        dateRange: { from: string | null; to: string | null };
        amountRange: { min: number; max: number };
        category: string | null;
        accountId: number | null;
        paymentMethod: string | null;
    };
    accounts: Account[];
}

export const AdvancedFilter = ({ onClose, onApply, currentFilters, accounts, count = 0 }: AdvancedFilterProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const [type, setType] = React.useState(currentFilters.type);
    const [category, setCategory] = React.useState(currentFilters.category);
    const [accountId, setAccountId] = React.useState(currentFilters.accountId);
    const [paymentMethod, setPaymentMethod] = React.useState(currentFilters.paymentMethod);

    // Date Picker States
    const [startDate, setStartDate] = React.useState<Date | null>(
        currentFilters.dateRange.from ? new Date(currentFilters.dateRange.from) : null
    );
    const [endDate, setEndDate] = React.useState<Date | null>(
        currentFilters.dateRange.to ? new Date(currentFilters.dateRange.to) : null
    );
    const [showPicker, setShowPicker] = React.useState<'start' | 'end' | null>(null);

    // Amount Slider States
    const [minAmount, setMinAmount] = React.useState(currentFilters.amountRange.min);
    const [maxAmount, setMaxAmount] = React.useState(currentFilters.amountRange.max);

    const sliderWidth = Dimensions.get('window').width - 48; // Horizontal padding

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        const currentDate = selectedDate || (showPicker === 'start' ? startDate : endDate);
        setShowPicker(null);
        if (showPicker === 'start') {
            setStartDate(currentDate);
        } else {
            setEndDate(currentDate);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatToApiDate = (date: Date | null) => {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    };

    // Slider PanResponder Logic
    const maxPossibleAmount = 10000;
    const sliderContainerWidth = Dimensions.get('window').width - 48; // Total padding

    const minPanResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // Optional: Provide visual feedback
            },
            onPanResponderTerminationRequest: () => false, // Critical: stops ScrollView from stealing touch
            onPanResponderMove: (evt, gestureState) => {
                const newX = Math.max(0, Math.min(gestureState.moveX - 24, sliderContainerWidth));
                const newValue = Math.round((newX / sliderContainerWidth) * maxPossibleAmount);
                const steppedValue = Math.round(newValue / 100) * 100;

                if (steppedValue < maxAmount) {
                    setMinAmount(steppedValue);
                }
            },
            onPanResponderRelease: () => {
                // Cleanup if needed
            }
        })
    ).current;

    const maxPanResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // Optional: Provide visual feedback
            },
            onPanResponderTerminationRequest: () => false, // Critical: stops ScrollView from stealing touch
            onPanResponderMove: (evt, gestureState) => {
                const newX = Math.max(0, Math.min(gestureState.moveX - 24, sliderContainerWidth));
                const newValue = Math.round((newX / sliderContainerWidth) * maxPossibleAmount);
                const steppedValue = Math.round(newValue / 100) * 100;

                if (steppedValue > minAmount) {
                    setMaxAmount(steppedValue);
                }
            },
            onPanResponderRelease: () => {
                // Cleanup if needed
            }
        })
    ).current;

    return (
        <View style={[styles.container, { backgroundColor: 'white' }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Find Your Transactions!</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <MaterialCommunityIcons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* When did this happen? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>WHEN DID THIS HAPPEN?</Text>
                    </View>
                    <View style={styles.dateContainer}>
                        <TouchableOpacity
                            onPress={() => setShowPicker('start')}
                            style={styles.dateCard}
                        >
                            <View>
                                <Text style={styles.dateHeader}>FROM</Text>
                                <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(startDate)}</Text>
                            </View>
                            <MaterialCommunityIcons name="calendar-outline" size={20} color="#FFAB91" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowPicker('end')}
                            style={styles.dateCard}
                        >
                            <View>
                                <Text style={styles.dateHeader}>TO</Text>
                                <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(endDate)}</Text>
                            </View>
                            <MaterialCommunityIcons name="calendar-outline" size={20} color="#FFAB91" />
                        </TouchableOpacity>
                    </View>
                </View>

                {showPicker && (
                    <DateTimePicker
                        value={showPicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                    />
                )}

                {/* What kind of money? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="molecule" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>WHAT KIND OF MONEY?</Text>
                    </View>
                    <View style={styles.tabContainer}>
                        {['Expense', 'Income'].map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.tab, type === t && styles.activeTab]}
                                onPress={() => setType(t)}
                            >
                                <Text style={[styles.tabText, type === t && styles.activeTabText]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* How much was it? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="cash-multiple" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>HOW MUCH WAS IT?</Text>
                        <View style={styles.amountBadge}>
                            <Text style={styles.amountBadgeText}>₹{minAmount} - ₹{maxAmount === maxPossibleAmount ? '10k+' : maxAmount}</Text>
                        </View>
                    </View>

                    <View style={styles.sliderContainer}>
                        <View style={styles.sliderTrack}>
                            {/* Track Fill */}
                            <View
                                style={[
                                    styles.sliderFill,
                                    {
                                        left: `${(minAmount / maxPossibleAmount) * 100}%`,
                                        width: `${((maxAmount - minAmount) / maxPossibleAmount) * 100}%`
                                    }
                                ]}
                            />

                            {/* Min Thumb */}
                            <View
                                style={[
                                    styles.sliderThumb,
                                    { left: `${(minAmount / maxPossibleAmount) * 100}%` }
                                ]}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                {...minPanResponder.panHandlers}
                            />

                            {/* Max Thumb */}
                            <View
                                style={[
                                    styles.sliderThumb,
                                    { left: `${(maxAmount / maxPossibleAmount) * 100}%` }
                                ]}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                {...maxPanResponder.panHandlers}
                            />
                        </View>
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabelText}>₹0</Text>
                            <Text style={styles.sliderLabelText}>₹10k+</Text>
                        </View>
                    </View>
                </View>

                {/* What was it for? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="tag-outline" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>WHAT WAS IT FOR?</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipsScroll}
                        contentContainerStyle={styles.chipsScrollContent}
                    >
                        {[
                            { name: 'Coffee', icon: 'coffee' },
                            { name: 'Groceries', icon: 'clover' },
                            { name: 'Gas', icon: 'gas-station' },
                            { name: 'Fun', icon: 'movie' },
                            { name: 'Home', icon: 'home' },
                        ].map((cat) => (
                            <TouchableOpacity
                                key={cat.name}
                                style={[styles.chip, category === cat.name && styles.activeChip]}
                                onPress={() => setCategory(cat.name)}
                            >
                                <MaterialCommunityIcons name={cat.icon as any} size={16} color={category === cat.name ? theme.accent : '#546E7A'} />
                                <Text style={[styles.chipText, category === cat.name && styles.activeChipText]}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.addChip}>
                            <MaterialCommunityIcons name="plus" size={20} color="#90A4AE" />
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Where from? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="bank-outline" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>WHERE FROM / WHERE TO?</Text>
                    </View>
                    <View style={styles.accountContainer}>
                        {accounts.map((account) => (
                            <TouchableOpacity
                                key={account.id}
                                style={[styles.accountChip, accountId === account.id && styles.activeAccountChip]}
                                onPress={() => setAccountId(accountId === account.id ? null : account.id)}
                            >
                                <MaterialCommunityIcons name={account.type === 'credit' ? 'credit-card' : 'bank'} size={16} color="#42A5F5" />
                                <Text style={styles.accountChipText}>{account.name}</Text>
                                {accountId === account.id && <View style={styles.activeDot} />}
                            </TouchableOpacity>
                        ))}
                        {accounts.length === 0 && <Text style={styles.accountChipText}>No accounts available</Text>}
                    </View>
                </View>

                {/* How did you pay? */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="wallet-outline" size={18} color="#90A4AE" />
                        <Text style={styles.sectionLabel}>HOW DID YOU PAY?</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollableRadioContainer}
                    >
                        {[
                            { name: 'Credit Card', value: 'Credit Card' },
                            { name: 'Debit Card', value: 'Debit Card' },
                            { name: 'Cash', value: 'Cash' },
                            { name: 'UPI', value: 'UPI' },
                            { name: 'Wallets', value: 'Wallets' },
                        ].map((pm) => (
                            <TouchableOpacity
                                key={pm.value}
                                style={[styles.radioButton, paymentMethod === pm.value && styles.activeRadioButton]}
                                onPress={() => setPaymentMethod(pm.value)}
                            >
                                <View style={[styles.radioCircle, paymentMethod === pm.value && { backgroundColor: '#D1C4E9', borderColor: '#D1C4E9' }]}>
                                    {paymentMethod === pm.value && <MaterialCommunityIcons name="check" size={12} color="#7E57C2" />}
                                </View>
                                <Text style={[styles.radioText, paymentMethod === pm.value && styles.activeRadioText]}>{pm.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        onPress={() => {
                            setType('All');
                            setCategory(null);
                            setAccountId(null);
                            setPaymentMethod(null);
                            setStartDate(null);
                            setEndDate(null);
                            setMinAmount(0);
                            setMaxAmount(10000);
                        }}
                    >
                        <Text style={styles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.applyButton, { backgroundColor: theme.accent }]}
                        onPress={() => onApply({
                            type,
                            category,
                            mode: paymentMethod,
                            account_id: accountId,
                            min_amount: minAmount,
                            max_amount: maxAmount,
                            start_date: formatToApiDate(startDate),
                            end_date: formatToApiDate(endDate)
                        })}
                    >
                        <View style={styles.showMeContent}>
                            <Text style={styles.applyButtonText}>Show Me!</Text>
                            <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{count}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 8,
        marginTop: 60
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        fontFamily: Fonts.title,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '900',
        color: '#90A4AE',
        letterSpacing: 1,
        marginLeft: 8,
        flex: 1,
    },
    dateContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    dateCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FCEFEF',
        padding: 16,
        borderRadius: 24,
    },
    dateHeader: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9E9E9E',
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FCEFEF',
        borderRadius: 30,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 26,
    },
    activeTab: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#9E9E9E',
    },
    activeTabText: {
        color: '#FF7043',
    },
    amountBadge: {
        backgroundColor: '#FFECB3',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    amountBadgeText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FF8F00',
    },
    sliderContainer: {
        marginTop: 8,
    },
    sliderTrack: {
        height: 4,
        backgroundColor: '#FFEBEE',
        borderRadius: 2,
        position: 'relative',
        justifyContent: 'center',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: '#FFAB91',
        borderRadius: 2,
        position: 'absolute',
    },
    sliderThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF7043',
        borderWidth: 4,
        borderColor: 'white',
        position: 'absolute',
        top: -10,
        transform: [{ translateX: -12 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    sliderLabelText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#B0BEC5',
    },
    chipsScroll: {
        marginHorizontal: -24,
    },
    chipsScrollContent: {
        paddingHorizontal: 24,
        gap: 10,
        paddingRight: 40, // Ensure + button is visible
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeChip: {
        backgroundColor: '#FBE9E7',
        borderColor: '#FFCCBC',
    },
    chipText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#455A64',
        marginLeft: 8,
    },
    activeChipText: {
        color: '#BF360C',
    },
    addChip: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#CFD8DC',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    accountContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    accountChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ECEFF1',
    },
    activeAccountChip: {
        borderColor: '#90CAF9',
        backgroundColor: '#E3F2FD',
    },
    accountChipText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#455A64',
        marginLeft: 8,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2196F3',
        marginLeft: 8,
    },
    radioContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    radioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ECEFF1',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    activeRadioButton: {
        backgroundColor: '#F3E5F5',
        borderColor: '#D1C4E9',
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#CFD8DC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    radioText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#78909C',
    },
    activeRadioText: {
        color: '#673AB7',
    },
    scrollableRadioContainer: {
        flexDirection: 'row',
        gap: 12,
        paddingRight: 24,
    },
    applyButton: {
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 4,
    },
    applyButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: Fonts.title,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    clearAllText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#90A4AE',
    },
    showMeContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    countBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    countBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

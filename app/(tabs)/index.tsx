import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
  Platform,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import '../../global.css';

type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  section: 'Today' | 'Yesterday';
};

const transactions: Transaction[] = [
  {
    id: '1',
    name: 'Starbucks',
    category: 'Food & Drink',
    amount: -15,
    icon: 'coffee-outline',
    section: 'Today',
  },
  {
    id: '2',
    name: 'Netflix Subscription',
    category: 'Entertainment',
    amount: -12.99,
    icon: 'play-box-multiple-outline',
    section: 'Today',
  },
  {
    id: '3',
    name: 'Salary',
    category: 'Income',
    amount: 2500,
    icon: 'cash-multiple',
    section: 'Yesterday',
  },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const accent = useThemeColor({}, 'accent');
  const defaultForm = useMemo(
    () => ({
      amount: '15.00',
      type: 'Expense',
      mode: 'Credit Card',
      category: 'Food',
      date: '24 August 2024',
      notes: '#coffee',
    }),
    []
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const sections = useMemo(() => {
    return ['Today', 'Yesterday'].map((title) => ({
      title,
      data: transactions.filter((item) => item.section === title),
    }));
  }, []);

  const surfaceColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
  const softBorder = colorScheme === 'light' ? theme.border : '#2E2E2E';
  const fieldBackground =
    colorScheme === 'light' ? 'rgba(217,217,217,0.35)' : 'rgba(60,60,60,0.45)';

  const typeOptions: Array<'Expense' | 'Income'> = ['Expense', 'Income'];
  const modeOptions = ['Cash', 'UPI', 'Credit Card', 'Wallets'];
  const categoryOptions = [
    'Food',
    'Travel',
    'Shopping',
    'Bills',
    'Family/Gifts',
    'Misc',
  ];

  const handleOpenEdit = () => {
    setForm({ ...defaultForm });
    setIsEditOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditOpen(false);
  };

  const handleSave = () => {
    setIsEditOpen(false);
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.appTitle}>Finance Minister</ThemedText>
        </View>

        <View
          style={[
            styles.voiceCard,
            {
              backgroundColor: surfaceColor,
              borderColor: softBorder,
            },
          ]}>
          <View style={styles.voiceTextGroup}>
            <ThemedText type="title" style={styles.voiceTitle}>
              Ask anything about your money.
            </ThemedText>
            <ThemedText
              style={styles.voiceHint}
              lightColor="rgba(26,26,26,0.6)"
              darkColor="rgba(250,250,250,0.7)">
              e.g., “Spent $15 on coffee at Starbucks”
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            style={[styles.voiceButton, { backgroundColor: accent }]}>
            <MaterialCommunityIcons name="microphone" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          style={[
            styles.confirmCard,
            {
              backgroundColor: surfaceColor,
              borderColor: softBorder,
            },
          ]}>
          <ThemedText type="subtitle" style={styles.cardSectionTitle}>
            Confirm Entry
          </ThemedText>
          <ThemedText
            type="title"
            style={[styles.amount, { color: theme.text }]}>
            $15.00
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: softBorder }]} />

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Type</ThemedText>
            <ThemedText style={styles.detailValue}>Expense</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Mode</ThemedText>
            <ThemedText style={styles.detailValue}>Credit Card</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Category</ThemedText>
            <ThemedText style={styles.detailValue}>Food & Drink</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Tag</ThemedText>
            <ThemedText style={styles.detailValue}>#coffee</ThemedText>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: accent }]}>
              <ThemedText style={styles.primaryButtonText}>Confirm</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[
                styles.secondaryButton,
                {
                  backgroundColor:
                    colorScheme === 'light'
                      ? 'rgba(217,217,217,0.4)'
                      : 'rgba(60,60,60,0.4)',
                },
              ]}
              onPress={handleOpenEdit}>
              <ThemedText style={styles.secondaryButtonText}>Edit</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button">
              <ThemedText
                style={styles.cancelText}
                lightColor="rgba(26,26,26,0.65)"
                darkColor="rgba(250,250,250,0.7)">
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderSectionHeader={({ section }) =>
            section.data.length === 0 ? null : (
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
            )
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.transactionItem,
                {
                  backgroundColor: surfaceColor,
                  borderColor: softBorder,
                },
              ]}>
              <View style={styles.transactionIconWrapper}>
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor:
                        colorScheme === 'light'
                          ? 'rgba(217,217,217,0.45)'
                          : 'rgba(60,60,60,0.65)',
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={theme.text}
                  />
                </View>
                <View>
                  <ThemedText style={styles.transactionName}>
                    {item.name}
                  </ThemedText>
                  <ThemedText
                    style={styles.transactionCategory}
                    lightColor="rgba(26,26,26,0.6)"
                    darkColor="rgba(250,250,250,0.6)">
                    {item.category}
                  </ThemedText>
                </View>
              </View>
              <ThemedText
                style={[
                  styles.transactionAmount,
                  {
                    color:
                      item.amount >= 0
                        ? accent
                        : 'rgba(26,26,26,0.65)',
                  },
                ]}
                darkColor={
                  item.amount >= 0 ? accent : 'rgba(250,250,250,0.65)'
                }>
                {item.amount >= 0 ? '+' : '-'}$
                {Math.abs(item.amount).toFixed(2)}
              </ThemedText>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 24 }} />}
        />
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={isEditOpen}
        presentationStyle="overFullScreen"
        onRequestClose={handleCloseEdit}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalOverlay} onPress={handleCloseEdit} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrapper}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.background,
                  borderColor: softBorder,
                },
              ]}>
              <View style={styles.dragHandle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetContent}>
                <ThemedText style={styles.sheetTitle}>Edit Transaction</ThemedText>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Amount
                  </ThemedText>
                  <View
                    style={[
                      styles.amountField,
                      {
                        backgroundColor: fieldBackground,
                        borderColor: softBorder,
                      },
                    ]}>
                    <ThemedText style={styles.currencySymbol}>$</ThemedText>
                    <TextInput
                      value={form.amount}
                      onChangeText={(text) =>
                        setForm((prev) => ({ ...prev, amount: text }))
                      }
                      keyboardType="decimal-pad"
                      style={[
                        styles.amountInput,
                        { color: theme.text },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Type
                  </ThemedText>
                  <View
                    style={[
                      styles.segmented,
                      { backgroundColor: fieldBackground, borderColor: softBorder },
                    ]}>
                    {typeOptions.map((option) => {
                      const isActive = form.type === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          onPress={() =>
                            setForm((prev) => ({ ...prev, type: option }))
                          }
                          style={[
                            styles.segmentedOption,
                            isActive && {
                              backgroundColor: theme.background,
                              shadowColor: 'rgba(0,0,0,0.08)',
                              shadowOpacity: 0.3,
                              shadowRadius: 8,
                              elevation: 1,
                            },
                          ]}>
                          <ThemedText
                            style={[
                              styles.segmentedLabel,
                              {
                                color:
                                  option === 'Expense'
                                    ? 'rgba(192,57,43,0.85)'
                                    : accent,
                              },
                              !isActive && { opacity: 0.6 },
                            ]}>
                            {option}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Mode
                  </ThemedText>
                  <View style={styles.chipGroup}>
                    {modeOptions.map((option) => {
                      const isActive = form.mode === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          onPress={() =>
                            setForm((prev) => ({ ...prev, mode: option }))
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isActive
                                ? accent
                                : fieldBackground,
                            },
                          ]}>
                          <ThemedText
                            style={[
                              styles.chipLabel,
                              { color: isActive ? '#FFFFFF' : theme.text },
                            ]}>
                            {option}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Category
                  </ThemedText>
                  <View style={styles.chipGroup}>
                    {categoryOptions.map((option) => {
                      const isActive = form.category === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          onPress={() =>
                            setForm((prev) => ({ ...prev, category: option }))
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isActive
                                ? accent
                                : fieldBackground,
                            },
                          ]}>
                          <ThemedText
                            style={[
                              styles.chipLabel,
                              { color: isActive ? '#FFFFFF' : theme.text },
                            ]}>
                            {option}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Date
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    style={[
                      styles.dateField,
                      {
                        backgroundColor: fieldBackground,
                        borderColor: softBorder,
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={20}
                      color={theme.text}
                    />
                    <ThemedText style={styles.dateLabel}>{form.date}</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={styles.fieldLabel}
                    lightColor="rgba(26,26,26,0.65)"
                    darkColor="rgba(250,250,250,0.65)">
                    Notes
                  </ThemedText>
                  <TextInput
                    multiline
                    numberOfLines={4}
                    style={[
                      styles.noteInput,
                      {
                        backgroundColor: fieldBackground,
                        borderColor: softBorder,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Add a note..."
                    placeholderTextColor={
                      colorScheme === 'light'
                        ? 'rgba(26,26,26,0.4)'
                        : 'rgba(250,250,250,0.4)'
                    }
                    value={form.notes}
                    onChangeText={(text) =>
                      setForm((prev) => ({ ...prev, notes: text }))
                    }
                  />
                </View>
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                style={[styles.sheetButton, { backgroundColor: accent }]}
                onPress={handleSave}>
                <ThemedText style={styles.sheetButtonText}>Save</ThemedText>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg * 2,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 20,
    fontFamily: Fonts.title,
    letterSpacing: 0.2,
  },
  voiceCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 2,
  },
  voiceTextGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  voiceTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  voiceHint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.body,
  },
  amount: {
    fontSize: 32,
    fontFamily: Fonts.title,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: 'rgba(26,26,26,0.6)',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.title,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    borderRadius: 24,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  secondaryButton: {
    borderRadius: 24,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.title,
    color: 'rgba(26,26,26,0.75)',
  },
  cancelText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.title,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: 20,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 1,
  },
  transactionIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionName: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  transactionCategory: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingBottom: spacing.lg + spacing.sm,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(26,26,26,0.2)',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  amountField: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  segmented: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.xs / 2,
    gap: spacing.xs,
  },
  segmentedOption: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedLabel: {
    fontSize: 15,
    fontFamily: Fonts.title,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderRadius: 18,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: Fonts.title,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dateLabel: {
    fontSize: 15,
    fontFamily: Fonts.body,
  },
  noteInput: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlignVertical: 'top',
  },
  sheetButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sheetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.title,
  },
});

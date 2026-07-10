import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAuthStore } from '@/hooks/use-auth-store';
import { fetchAccounts, saveAccount, updateAccount } from '@/lib/accounts';

type AccountTypeOption = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bgColor: string;
};

const typeOptions: AccountTypeOption[] = [
  { key: 'cash', label: 'Cash', icon: 'cash', color: '#2ECC71', bgColor: '#EAF8F0' },
  { key: 'credit', label: 'Credit', icon: 'credit-card', color: '#8257E5', bgColor: '#F4F1FE' },
  { key: 'debit', label: 'Debit', icon: 'cash-multiple', color: '#00A8FF', bgColor: '#E6F6FF' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet', color: '#FF9F43', bgColor: '#FFF4EB' },
  { key: 'upi', label: 'UPI', icon: 'qrcode-scan', color: '#00D2B4', bgColor: '#E6FBFA' },
  { key: 'bank', label: 'Bank', icon: 'bank', color: '#3B5998', bgColor: '#EBF0FF' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal', color: '#546E7A', bgColor: '#F0F4F7' },
];

const COLORS = [
  '#FF7A7A',
  '#FF9F43',
  '#FFD32D',
  '#2ECC71',
  '#54A0FF',
  '#8190FF',
  '#B57AFF',
  '#FF79B0',
];

const CARD_ISSUERS = [
  { id: '1', name: 'HDFC Bank', icon: 'bank' },
  { id: '2', name: 'ICICI Bank', icon: 'bank' },
  { id: '3', name: 'SBI (State Bank of India)', icon: 'bank' },
  { id: '4', name: 'Axis Bank', icon: 'bank' },
  { id: '5', name: 'American Express', icon: 'credit-card' },
  { id: '6', name: 'HSBC', icon: 'bank' },
  { id: '7', name: 'Standard Chartered', icon: 'bank' },
  { id: '8', name: 'Kotak Mahindra Bank', icon: 'bank' },
  { id: '9', name: 'Citibank', icon: 'bank' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function ManageAccountScreen() {
  const { token } = useAuthStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accountId = id ? Number(id) : null;
  const isEditing = Number.isInteger(accountId) && accountId !== null && accountId > 0;
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(isEditing);
  const [isDefault, setIsDefault] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step navigation
  const [step, setStep] = useState(1);

  // Step 1 States
  const [selectedType, setSelectedType] = useState('bank');
  const [selectedColor, setSelectedColor] = useState('#54A0FF');
  const [name, setName] = useState('');

  // Step 2 States
  const [issuerQuery, setIssuerQuery] = useState('');
  const [selectedIssuer, setSelectedIssuer] = useState<(typeof CARD_ISSUERS)[0] | null>(null);
  const [showIssuerResults, setShowIssuerResults] = useState(false);

  const [last4, setLast4] = useState('');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [feeMonth, setFeeMonth] = useState('');

  // Modal States
  const [showDayModal, setShowDayModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);

  useEffect(() => {
    if (!token || !isEditing || accountId === null) {
      setIsLoadingAccount(false);
      return;
    }
    let active = true;
    void fetchAccounts(token)
      .then((accounts) => {
        if (!active) return;
        const account = accounts.find((candidate) => candidate.id === accountId);
        if (!account) {
          throw new Error('Account not found.');
        }
        setSelectedType(account.type);
        setSelectedColor(account.color || '#54A0FF');
        setName(account.name);
        setIssuerQuery(account.provider || '');
        setSelectedIssuer(CARD_ISSUERS.find((issuer) => issuer.name === account.provider) ?? null);
        setLast4(account.identifier || '');
        setBalance(account.balance ? String(account.balance) : '');
        setCreditLimit(account.credit_limit ? String(account.credit_limit) : '');
        setDueDay(account.due_day ? String(account.due_day) : '');
        setFeeMonth(account.fee_month || '');
        setIsDefault(Boolean(account.is_default));
      })
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : 'Unable to load account.');
        router.back();
      })
      .finally(() => {
        if (active) setIsLoadingAccount(false);
      });
    return () => {
      active = false;
    };
  }, [accountId, isEditing, token]);

  const handleSave = async () => {
    if (!token) return;
    if (!name) {
      setSaveError('Please enter a name for the account.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        type: selectedType,
        name: name,
        color: selectedColor,
        provider: selectedIssuer?.name || issuerQuery.trim(),
        identifier: last4,
        credit_limit: parseFloat(creditLimit) || 0,
        due_day: parseInt(dueDay) || 0,
        fee_month: feeMonth,
        balance: parseFloat(balance) || 0,
        is_default: isDefault,
      };
      if (isEditing && accountId !== null) {
        await updateAccount(token, accountId, payload);
      } else {
        await saveAccount(token, payload);
      }
      router.back();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save account.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredIssuers = useMemo(() => {
    if (!issuerQuery) return [];
    return CARD_ISSUERS.filter((i) => i.name.toLowerCase().includes(issuerQuery.toLowerCase()));
  }, [issuerQuery]);

  const renderSelectionModal = (
    visible: boolean,
    onClose: () => void,
    data: string[],
    onSelect: (item: string) => void,
    title: string
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>{title}</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {data.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}>
                <ThemedText style={styles.modalItemText}>{item}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );

  const renderStep1 = () => (
    <>
      <ScreenHeader
        subtitle="STEP 1 OF 2"
        onBack={() => router.back()}
        rightIcon="help-circle-outline"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Mascot & Message */}
        <View style={styles.mascotSection}>
          <View style={styles.bubbleContainer}>
            <ThemedText style={styles.bubbleText}>
              {isEditing ? 'Update your account details.' : 'Let&apos;s set up your new account!'}
            </ThemedText>
            <View style={styles.bubbleTriangle} />
          </View>
          <View style={styles.mascotRow}>
            <View style={styles.mascotAvatar}>
              <MaterialCommunityIcons name="face-woman-outline" size={24} color="#FF8A65" />
            </View>
            <ThemedText style={styles.mascotCaption}>
              &quot;I&apos;ll help you organize your cash flow.&quot;
            </ThemedText>
          </View>
        </View>

        {/* Account Type Selection */}
        <ThemedText style={styles.sectionTitle}>What kind of account is this?</ThemedText>
        <View style={styles.gridContainer}>
          {typeOptions.map((option) => {
            const isSelected = selectedType === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setSelectedType(option.key)}
                style={[
                  styles.gridItem,
                  isSelected ? styles.gridItemSelected : styles.gridItemUnselected,
                ]}>
                <View style={[styles.gridIconContainer, { backgroundColor: option.bgColor }]}>
                  <MaterialCommunityIcons name={option.icon} size={24} color={option.color} />
                </View>
                <View style={styles.gridLabelContainer}>
                  <ThemedText
                    style={[
                      styles.gridLabel,
                      isSelected ? styles.textSelected : styles.textUnselected,
                    ]}>
                    {option.label}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Name Input */}
        <ThemedText style={styles.sectionTitle}>What should we call it?</ThemedText>
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons
            name="tag-outline"
            size={24}
            color="#FFAD91"
            style={styles.inputIcon}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My Spending Account"
            placeholderTextColor="#AAB7C6"
            style={styles.textInput}
          />
        </View>

        {/* Color Picker */}
        <ThemedText style={styles.sectionTitle}>Pick a happy color!</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorScroll}>
          {COLORS.map((color) => {
            const isSelected = selectedColor === color;
            return (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[
                  styles.colorItem,
                  { backgroundColor: color },
                  isSelected && styles.colorItemSelected,
                ]}>
                {isSelected && <View style={[styles.colorRing, { borderColor: '#FFAD91' }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Footer Step 1 */}
      <View style={styles.footer}>
        {saveError ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#D32F2F" />
            <ThemedText style={styles.errorText}>{saveError}</ThemedText>
          </View>
        ) : null}
        <View style={styles.footerActions}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep(2)}
            style={styles.saveButton}
            disabled={isSaving}>
            <ThemedText style={styles.saveButtonText}>
              {isEditing ? 'Continue' : 'Looks Good! Save'}
            </ThemedText>
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialCommunityIcons name="thumb-up-outline" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderStep2 = () => {
    if (selectedType === 'credit') {
      return (
        <View style={{ flex: 1 }}>
          <ScreenHeader
            subtitle="STEP 2 OF 2"
            onBack={() => setStep(1)}
            rightText="Skip"
            onRightPress={() => router.back()}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Mascot & Message Step 2 */}
            <View style={styles.mascotSection}>
              <View style={[styles.bubbleContainer, { backgroundColor: '#F4F1FE' }]}>
                <ThemedText style={styles.bubbleText}>
                  Yay! Let&apos;s set up your plastic power.
                </ThemedText>
                <View style={[styles.bubbleTriangle, { backgroundColor: '#F4F1FE' }]} />
              </View>
              <View style={styles.mascotRowCenter}>
                <View
                  style={[
                    styles.mascotAvatar,
                    { backgroundColor: '#FFEEED', width: 56, height: 56, borderRadius: 28 },
                  ]}>
                  <MaterialCommunityIcons name="face-woman-outline" size={32} color="#FF8A65" />
                </View>
              </View>
            </View>

            <ThemedText style={styles.sectionHeaderLabel}>VISUALS</ThemedText>

            <ThemedText style={styles.labelSmall}>Choose your card</ThemedText>
            <View style={styles.searchWrapper}>
              <View style={styles.dropdownContainer}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={24}
                  color="#FFAD91"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInputSmall}
                  value={issuerQuery}
                  onChangeText={(text) => {
                    setIssuerQuery(text);
                    setShowIssuerResults(true);
                  }}
                  onFocus={() => setShowIssuerResults(true)}
                  placeholder="Search issuer (e.g. HDFC, A)"
                  placeholderTextColor="#AAB7C6"
                />
                <MaterialCommunityIcons name="chevron-down" size={24} color="#AAB7C6" />
              </View>

              {showIssuerResults && filteredIssuers.length > 0 && (
                <View style={styles.resultsList}>
                  {filteredIssuers.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.resultItem}
                      onPress={() => {
                        setSelectedIssuer(item);
                        setIssuerQuery(item.name);
                        setShowIssuerResults(false);
                      }}>
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={20}
                        color="#FFAD91"
                        style={{ marginRight: 10 }}
                      />
                      <ThemedText style={styles.resultItemText}>{item.name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <ThemedText style={styles.labelSmall}>Last 4 digits</ThemedText>
            <View style={styles.inputContainerSmall}>
              <MaterialCommunityIcons
                name="numeric-4-box-outline"
                size={24}
                color="#FFAD91"
                style={styles.inputIcon}
              />
              <TextInput
                value={last4}
                onChangeText={(val) => setLast4(val.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor="#AAB7C6"
                keyboardType="number-pad"
                style={styles.textInputSmall}
              />
            </View>

            <View style={{ height: 24 }} />

            <ThemedText style={styles.sectionHeaderLabel}>ALERTS & LIMITS</ThemedText>

            <ThemedText style={styles.labelSmall}>Credit Limit</ThemedText>
            <View style={styles.inputContainerSmall}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={24}
                color="#FFAD91"
                style={styles.inputIcon}
              />
              <TextInput
                value={creditLimit}
                onChangeText={(val) => setCreditLimit(val.replace(/[^0-9]/g, ''))}
                placeholder="1,00,000"
                placeholderTextColor="#AAB7C6"
                keyboardType="number-pad"
                style={styles.textInputSmall}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.labelSmall}>Due Day</ThemedText>
                <TouchableOpacity
                  style={styles.dropdownContainerSmall}
                  onPress={() => setShowDayModal(true)}>
                  <MaterialCommunityIcons
                    name="calendar-outline"
                    size={20}
                    color="#FFAD91"
                    style={styles.inputIcon}
                  />
                  <ThemedText style={[styles.dropdownTextSmall, !dueDay && { color: '#AAB7C6' }]}>
                    {dueDay || 'Day'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#AAB7C6" />
                </TouchableOpacity>
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.labelSmall}>Fee Month</ThemedText>
                <TouchableOpacity
                  style={styles.dropdownContainerSmall}
                  onPress={() => setShowMonthModal(true)}>
                  <MaterialCommunityIcons
                    name="calendar-refresh-outline"
                    size={20}
                    color="#FFAD91"
                    style={styles.inputIcon}
                  />
                  <ThemedText style={[styles.dropdownTextSmall, !feeMonth && { color: '#AAB7C6' }]}>
                    {feeMonth || 'Month'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#AAB7C6" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer Step 2 */}
          <View style={styles.footer}>
            {saveError ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#D32F2F" />
                <ThemedText style={styles.errorText}>{saveError}</ThemedText>
              </View>
            ) : null}
            <View style={styles.footerActions}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.cancelButton}>
                <ThemedText style={styles.cancelText}>Back</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: '#FF8A65' }]}
                disabled={isSaving}>
                <ThemedText style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Done 🎉'}
                </ThemedText>
                {isSaving && <ActivityIndicator size="small" color="white" className="ml-2" />}
              </TouchableOpacity>
            </View>
          </View>

          {renderSelectionModal(
            showDayModal,
            () => setShowDayModal(false),
            DAYS,
            setDueDay,
            'Select Due Day'
          )}
          {renderSelectionModal(
            showMonthModal,
            () => setShowMonthModal(false),
            MONTHS,
            setFeeMonth,
            'Select Fee Month'
          )}
        </View>
      );
    }

    // Generic Step 2 for other account types
    return (
      <>
        <ScreenHeader
          subtitle="STEP 2 OF 2"
          onBack={() => setStep(1)}
          rightText="Skip"
          onRightPress={() => router.back()}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.mascotSection}>
            <View style={styles.bubbleContainer}>
              <ThemedText style={styles.bubbleText}>
                Almost there! Adding some finishing touches.
              </ThemedText>
              <View style={styles.bubbleTriangle} />
            </View>
          </View>

          <ThemedText style={styles.sectionTitle}>Initial Balance</ThemedText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="scale-balance"
              size={24}
              color="#FFAD91"
              style={styles.inputIcon}
            />
            <TextInput
              value={balance}
              onChangeText={(value) => setBalance(value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor="#AAB7C6"
              keyboardType="decimal-pad"
              style={styles.textInput}
            />
          </View>

          <ThemedText style={styles.sectionTitle}>Account Number (Optional)</ThemedText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="card-text-outline"
              size={24}
              color="#FFAD91"
              style={styles.inputIcon}
            />
            <TextInput
              value={last4}
              onChangeText={(value) => setLast4(value.replace(/[^0-9]/g, '').slice(-4))}
              placeholder="1234 5678 9012"
              placeholderTextColor="#AAB7C6"
              keyboardType="number-pad"
              style={styles.textInput}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {saveError ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#D32F2F" />
              <ThemedText style={styles.errorText}>{saveError}</ThemedText>
            </View>
          ) : null}
          <View style={styles.footerActions}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.cancelButton}>
              <ThemedText style={styles.cancelText}>Back</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
              <ThemedText style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Finish Setup'}
              </ThemedText>
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialCommunityIcons name="check-all" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {isLoadingAccount ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#FF8A65" />
            <ThemedText>Loading account...</ThemedText>
          </View>
        ) : step === 1 ? (
          renderStep1()
        ) : (
          renderStep2()
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F7FC',
  },
  container: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  mascotSection: {
    marginBottom: 40,
  },
  bubbleContainer: {
    backgroundColor: '#EFEAFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    position: 'relative',
  },
  bubbleText: {
    fontSize: 18,
    fontFamily: Fonts.title,
    fontWeight: '900',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  bubbleTriangle: {
    position: 'absolute',
    bottom: -8,
    left: 24,
    width: 16,
    height: 16,
    backgroundColor: '#EFEAFF',
    transform: [{ rotate: '45deg' }],
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascotRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFDED6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  mascotCaption: {
    fontSize: 14,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
    color: '#9E9E9E',
    fontWeight: '500',
  },
  sectionHeaderLabel: {
    fontSize: 12,
    fontFamily: Fonts.title,
    fontWeight: '900',
    color: '#AAB7C6',
    letterSpacing: 1.5,
    marginBottom: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '900',
    marginBottom: 16,
    color: '#2D3436',
  },
  labelSmall: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '900',
    color: '#2D3436',
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 32,
  },
  gridItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 24,
  },
  gridItemSelected: {
    borderColor: '#FFAD91',
    backgroundColor: 'white',
  },
  gridItemUnselected: {
    borderColor: 'transparent',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  gridIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontFamily: Fonts.title,
    fontWeight: '900',
  },
  textSelected: {
    color: '#1A1A1A',
  },
  textUnselected: {
    color: '#BDBDBD',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchWrapper: {
    zIndex: 1000,
    position: 'relative',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  resultsList: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 24,
    maxHeight: 200,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    paddingVertical: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  resultItemText: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.title,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  textInputSmall: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dropdownContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownTextSmall: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  colorScroll: {
    gap: 12,
    paddingRight: 24,
  },
  colorItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  colorItemSelected: {
    borderColor: 'white',
  },
  colorRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 30,
    borderWidth: 2,
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#F9F7FC',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.12)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#D32F2F',
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '900',
    color: '#BDBDBD',
  },
  saveButton: {
    backgroundColor: '#FFAD91',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 32,
    shadowColor: '#FFAD91',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Fonts.title,
    fontWeight: '900',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.title,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  modalList: {
    paddingHorizontal: 24,
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  modalItemText: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeHeader } from '@/components/home/HomeHeader';
import { QuickPrompts } from '@/components/home/QuickPrompts';
import { TransactionItem } from '@/components/home/TransactionItem';
import { VoiceInputCard } from '@/components/home/VoiceInputCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  API_BASE_URL,
  formatDateLabel,
  groupTransactionsBySection,
  loadTransactions,
  normalizeDateLabel,
  parseDateLabel,
  toTitleCase,
} from '@/lib/transactions';
import { Transaction } from '@/types/transaction';
import { useAuthStore } from '@/hooks/use-auth-store';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import * as DocumentPicker from 'expo-document-picker';

import '../../global.css';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type ParseResponse = {
  type: string | null;
  title: string | null;
  time: string | null;
  amount: number | null;
  currency: string | null;
  mode: string | null;
  card_network: string | null;
  account_hint: string | null;
  category: string | null;
  merchant: string | null;
  tag: string | null;
  notes: string | null;
  date: string | null;
  source_text: string | null;
  confidence?: Record<string, number>;
  needs_confirmation?: Record<string, boolean>;
  clarifications?: string[];
};

type EntryForm = {
  title: string;
  time: string;
  amount: string;
  type: string;
  mode: string;
  category: string;
  date: string;
  notes: string;
  tag: string;
  currency: string;
  account: string;
  merchant: string;
  attachment: string | null;
};

const requiredFields: (keyof EntryForm)[] = ['title', 'amount', 'type', 'mode', 'category', 'date'];
const fieldLabels: Record<keyof EntryForm, string> = {
  title: 'Transaction Title',
  time: 'Time',
  amount: 'Amount',
  type: 'Type',
  mode: 'Mode',
  category: 'Category',
  date: 'Date',
  notes: 'Notes',
  tag: 'Tag',
  currency: 'Currency',
  account: 'Account',
  merchant: 'Merchant',
  attachment: 'Attachment',
};

const typeOptions: ('Expense' | 'Income' | 'Transfer')[] = ['Expense', 'Income', 'Transfer'];
const modeOptions = ['Cash', 'UPI', 'Credit Card', 'Wallets'];
const categoryOptions = ['Food', 'Travel', 'Shopping', 'Bills', 'Family/Gifts', 'Misc'];
const tagOptions = ['Investment', 'Lending', 'EMI', 'Subscription', 'General'];
const accountOptions = ['Main Account', 'Savings', 'ICICI Bank', 'HDFC Credit', 'Cash Wallet'];

const titleFont = { fontFamily: Fonts.title };
const bodyFont = { fontFamily: Fonts.body };

const cardShadow = {
  shadowColor: 'rgba(0,0,0,0.08)',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 20,
  elevation: 2,
};

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const accent = useThemeColor({}, 'accent');
  const router = useRouter();
  const { token } = useAuthStore();
  const defaultForm: EntryForm = useMemo(() => {
    return {
      title: '',
      amount: '',
      type: 'Expense',
      mode: 'Credit Card',
      category: 'Food',
      date: formatDateLabel(new Date()),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      notes: '',
      tag: 'General',
      currency: 'USD',
      account: 'Main Account',
      merchant: '',
      attachment: null,
    };
  }, []);
  const createBlankForm = useCallback((): EntryForm => {
    return {
      title: '',
      amount: '',
      type: 'Expense',
      mode: 'Cash',
      category: 'Food',
      date: formatDateLabel(new Date()),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      notes: '',
      tag: 'General',
      currency: 'USD',
      account: 'Cash',
      merchant: '',
      attachment: null,
    };
  }, []);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMoreDetailsExpanded, setIsMoreDetailsExpanded] = useState(false);
  const [form, setForm] = useState<EntryForm>({ ...defaultForm });
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(parseDateLabel(defaultForm.date) ?? new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isModePickerVisible, setIsModePickerVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);

  const sections = useMemo(() => groupTransactionsBySection(transactions), [transactions]);
  const visibleSections = useMemo(() => sections.slice(0, 3), [sections]);
  const hasTransactions = sections.length > 0;

  const surfaceColor = colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E';
  const softBorder = colorScheme === 'light' ? theme.border : '#2E2E2E';
  const fieldBackground =
    colorScheme === 'light' ? 'rgba(217,217,217,0.35)' : 'rgba(60,60,60,0.45)';
  const fetchEntries = useCallback(async () => {
    if (!token) return;
    setIsEntriesLoading(true);
    setEntriesError(null);
    try {
      const mapped = await loadTransactions(token);
      setTransactions(mapped);
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : 'Unable to load entries right now.');
    } finally {
      setIsEntriesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const ensureMicPermission = useCallback(async () => {
    if (permissionResponse?.status === 'granted') {
      return true;
    }
    const permission = await requestPermission?.();
    return permission?.status === 'granted';
  }, [permissionResponse?.status, requestPermission]);

  const startRecording = useCallback(async () => {
    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      setErrorMessage('Microphone permission is required to record audio.');
      return;
    }
    try {
      setErrorMessage(null);
      setRecordedUri(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const recordingObject = new Audio.Recording();
      await recordingObject.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingObject.startAsync();
      setRecording(recordingObject);
      setIsRecording(true);
    } catch {
      setErrorMessage('Unable to start recording. Please try again.');
      setRecording(null);
      setIsRecording(false);
    }
  }, [ensureMicPermission]);

  const stopRecording = useCallback(async () => {
    if (!recording) {
      return;
    }
    try {
      console.log("stop pressed")
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
    } catch {
      setErrorMessage('Unable to stop recording. Please try again.');
    } finally {
      setRecording(null);
      setIsRecording(false);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        // Ignore - resetting audio mode is best-effort.
      }
    }
  }, [recording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  const handleClearRecording = useCallback(() => {
    setRecordedUri(null);
    setInputText('');
    setErrorMessage(null);
  }, []);

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setFormError(null);
  };

  const handleOpenManualEntry = useCallback(() => {
    const blankForm = createBlankForm();
    setForm(blankForm);
    setPendingDate(parseDateLabel(blankForm.date) ?? new Date());
    setInputText('');
    setRecordedUri(null);
    setIsTextInputVisible(false);
    setErrorMessage(null);
    setFormError(null);
    setIsEditOpen(true);
  }, [createBlankForm]);

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDateLabel(form.date) ?? new Date(),
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            // First set date
            const dateStr = formatDateLabel(selectedDate);
            setForm(prev => ({ ...prev, date: dateStr }));

            // Then open time picker
            DateTimePickerAndroid.open({
              value: new Date(),
              mode: 'time',
              is24Hour: false,
              onChange: (event: DateTimePickerEvent, selectedTime?: Date) => {
                if (event.type === 'set' && selectedTime) {
                  const timeStr = selectedTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  setForm(prev => ({ ...prev, time: timeStr }));
                }
              },
            });
          }
        },
        mode: 'date',
      });
    } else {
      setPendingDate(parseDateLabel(form.date) ?? new Date());
      setIsDatePickerVisible(true);
    }
  };

  const handleIosDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) {
        setPendingDate(selectedDate);
      }
    },
    [],
  );

  const handleConfirmDatePicker = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      date: formatDateLabel(pendingDate),
      time: pendingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }));
    setFormError(null);
    setIsDatePickerVisible(false);
  }, [pendingDate]);

  const handleCancelDatePicker = useCallback(() => {
    setIsDatePickerVisible(false);
  }, []);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setForm((prev) => ({ ...prev, attachment: result.assets[0].uri }));
    } catch (err) {
      console.log('Document picker error:', err);
    }
  };

  const handleConfirmEntry = useCallback(async () => {
    const missingField = requiredFields.find((field) => {
      const value = form[field];
      return typeof value === 'string' ? value.trim().length === 0 : !value;
    });

    if (missingField) {
      setFormError(`Please provide ${fieldLabels[missingField]}.`);
      return;
    }

    const amountValue = Number(form.amount);
    if (Number.isNaN(amountValue)) {
      setFormError('Please enter a valid amount.');
      return;
    }

    setFormError(null);
    setIsSavingEntry(true);
    try {
      let attachmentUrl = form.attachment;

      // Upload attachment if it's a local file
      if (form.attachment && (form.attachment.startsWith('file://') || form.attachment.startsWith('content://'))) {
        const formData = new FormData();
        const filename = form.attachment.split('/').pop() || 'file';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'application/octet-stream';

        formData.append('file', {
          uri: form.attachment,
          name: filename,
          type,
        } as any);

        const uploadRes = await fetch(`${API_BASE_URL}/v1/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          attachmentUrl = data.url;
        } else {
          console.log('Upload failed', await uploadRes.text());
          // Continue without attachment or handle error? For now, continue without
          // attachmentUrl = null; 
        }
      }

      const parsedDate = parseDateLabel(form.date);
      const trimmedTag = form.tag.trim();
      const response = await fetch(`${API_BASE_URL}/v1/entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountValue,
          type: form.type.toLowerCase(),
          mode: form.mode,
          category: form.category,
          notes: form.notes.trim(),
          date: parsedDate ? parsedDate.toISOString() : form.date,
          tag: trimmedTag.length > 0 ? trimmedTag : null,
          account: form.account,
          merchant: form.merchant.trim(),
          title: form.title.trim() || 'Untitled Transaction',
          time: form.time,
          attachment: attachmentUrl,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to save the entry right now.');
      }
      await fetchEntries();
      const blankForm = createBlankForm();
      setForm(blankForm);
      setPendingDate(parseDateLabel(blankForm.date) ?? new Date());
      setIsEditOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save your entry. Please try again.');
    } finally {
      setIsSavingEntry(false);
    }
  }, [createBlankForm, fetchEntries, form]);

  const handleSubmitPrompt = useCallback(async () => {
    if (isSubmitting) {
      return;
    }
    const trimmed = inputText.trim();
    if (!trimmed && !recordedUri) {
      setErrorMessage('Please type or record your expense first.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setFormError(null);
    try {
      const formData = new FormData();
      if (trimmed) {
        formData.append('hint_text', trimmed);
      } else if (recordedUri) {
        const extension = recordedUri.split('.').pop();
        const fileName = `recording.${extension ?? 'm4a'}`;
        formData.append('audio', {
          uri: recordedUri,
          name: fileName,
          type: extension === 'wav' ? 'audio/wav' : 'audio/m4a',
        } as unknown as Blob);
        formData.append('tz', 'Asia/Kolkata');
      }
      const response = await fetch(`${API_BASE_URL}/v1/parse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to parse the entry right now.');
      }
      const data: ParseResponse = await response.json();
      console.log('Parse response:', data);
      setForm((prev) => {
        const formattedDate = normalizeDateLabel(data.date, prev.date);
        console.log('Normalized date:', formattedDate);
        const tagValue = data.tag ?? prev.tag;
        return {
          ...prev,
          title: data.title ?? prev.title,
          amount: data.amount != null ? data.amount.toFixed(2) : prev.amount,
          time: data.time ?? prev.time,
          type: toTitleCase(data.type) ?? prev.type,
          mode: data.mode ?? prev.mode,
          category: data.category ?? prev.category,
          merchant: data.merchant ?? prev.merchant,
          notes: data.notes ?? prev.notes,
          date: formattedDate,
          tag: tagValue ? toTitleCase(tagValue) ?? prev.tag : prev.tag,
        };
      });
      setInputText('');
      setRecordedUri(null);
      setIsTextInputVisible(false);
      setIsEditOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while parsing.');
    } finally {
      setIsSubmitting(false);
    }
  }, [inputText, isSubmitting, recordedUri]);

  const canSubmit = useMemo(
    () => !isRecording && (inputText.trim().length > 0 || !!recordedUri),
    [inputText, isRecording, recordedUri],
  );

  const renderTransactionCard = (item: Transaction) => {
    const isIncome = item.entryType === 'income' || item.amount >= 0;
    const displayAmount = Math.abs(item.amount).toFixed(2);
    // Format date roughly for now, can be improved with date-fns or similar
    const dateObj = item.rawDate ? new Date(item.rawDate) : new Date();
    const dateStr = item.dateLabel || dateObj.toLocaleDateString();

    return (
      <TransactionItem
        key={item.id}
        icon={item.icon as any} // Ensure icon compatibility
        title={item.name}
        category={item.category}
        subtitle={item.mode ?? undefined}
        amount={`${CURRENCY_SYMBOL}${displayAmount}`}
        date={dateStr}
        isIncome={isIncome}
        onPress={() => {
          router.push({
            pathname: '/entry/[id]',
            params: {
              id: item.id,
              name: item.name,
              category: item.category,
              amount: displayAmount,
              entryType: item.entryType ?? 'expense',
              section: item.section,
              mode: item.mode ?? '',
              notes: item.notes ?? '',
              merchant: item.merchant ?? '',
              dateLabel: item.dateLabel ?? '',
              rawDate: item.rawDate ?? '',
              tag: item.tag ?? '',
            },
          });
        }}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <HomeHeader />

        <View className="px-6 pb-6">
          <ThemedText className="text-3xl font-black leading-tight text-center" style={{ color: theme.text }}>What did you do today?</ThemedText>
          <ThemedText className="text-sm text-gray-500 mt-2 font-medium text-center">Let's track your ins and outs!</ThemedText>
        </View>

        {/* Main Interaction Card */}
        <VoiceInputCard
          onMicPress={handleToggleRecording}
          isRecording={isRecording}
          hasRecording={!!recordedUri}
          inputText={inputText}
          onChangeText={setInputText}
          onProcess={handleSubmitPrompt}
          onClear={handleClearRecording}
          isProcessing={isSubmitting}
        />

        {/* Quick Prompts */}
        <QuickPrompts />

        {/* Recent Activity */}
        <View className="px-6 pb-2 flex-row items-center justify-between">
          <ThemedText className="text-lg font-bold" style={{ color: theme.text }}>Recent Activity</ThemedText>
          <Pressable onPress={() => router.push('/transactions')}>
            <ThemedText className="text-sm" style={{ color: theme.accent }}>See All</ThemedText>
          </Pressable>
        </View>

        <View className="pb-24">
          {entriesError && (
            <ThemedText className="px-6 text-sm text-red-500">
              {entriesError}
            </ThemedText>
          )}
          {isEntriesLoading && (
            <View className="items-center py-4">
              <ActivityIndicator color={theme.accent} />
            </View>
          )}
          {!isEntriesLoading && sections.length === 0 && !entriesError && (
            <ThemedText className="px-6 text-sm text-gray-500 text-center py-10">
              No entries yet. Start by adding your first transaction!
            </ThemedText>
          )}
          {/* Flatten sections for this view or just show first few items */}
          {visibleSections.map((section) => (
            <View key={section.title}>
              {section.data.map(renderTransactionCard)}
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Floating Plus Button (Optional, can keep or remove based on design. Design didn't explicitly show it but usually good UX) */}
      {/* Kept for manual entry fallback */}
      <Pressable
        accessibilityRole="button"
        onPress={handleOpenManualEntry}
        className="h-14 w-14 items-center justify-center rounded-full absolute right-6 bottom-8 shadow-lg"
        style={{
          backgroundColor: theme.accent,
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal
        transparent
        animationType="slide"
        visible={isEditOpen}
        presentationStyle="overFullScreen"
        onRequestClose={handleCloseEdit}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="absolute inset-0" onPress={handleCloseEdit} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 justify-end"
          >
            <View
              className="rounded-t-[40px] shadow-2xl relative overflow-hidden"
              style={{ backgroundColor: theme.background }}
            >
              {/* Top Handle / Close Button Area */}
              <View className="items-center pt-8 pb-4 relative">
                <View className="h-1.5 w-12 rounded-full absolute top-3 bg-gray-200" />
                <Pressable
                  onPress={handleCloseEdit}
                  className="absolute right-6 top-6 h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
                >
                  <MaterialCommunityIcons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: '90%' }}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {/* AI Header Section */}
                <View className="items-center px-6 mb-8">
                  {/* <View className="relative">
                    <View className="h-24 w-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                      <Image
                        source={{ uri: 'https://i.pravatar.cc/150?img=32' }}
                        className="h-full w-full"
                      />
                    </View>
                    <View className="absolute -top-2 -right-12 bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-orange-100 rotate-12">
                      <ThemedText className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">AI SAYS:</ThemedText>
                    </View>
                  </View> */}

                  <ThemedText className="text-2xl font-black mt-6 mb-2" style={{ color: theme.text }}>
                    I've sorted the details!
                  </ThemedText>
                  <ThemedText className="text-center text-gray-500 text-sm leading-5 px-4">
                    Here's what I understood from your voice note. Just confirm the bits before you save.
                  </ThemedText>
                </View>

                {/* Form Fields - CONFIRMED BY AI */}
                <View className="px-6 mb-8">
                  <View className="flex-row justify-between items-center mb-4">
                    <ThemedText className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic">Confirmed by AI</ThemedText>
                    <View className="flex-row items-center bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                      <MaterialCommunityIcons name="check-decagram-outline" size={12} color="#10B981" />
                      <ThemedText className="text-[9px] font-black text-emerald-600 ml-1 uppercase">Confidence: High</ThemedText>
                    </View>
                  </View>

                  {/* Transaction Type */}

                  <View className='mb-4'>
                    <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Transaction Type</ThemedText>
                    <View className="flex-row bg-gray-50 dark:bg-gray-800/50 rounded-[20px] p-1">
                      {typeOptions.map((opt) => (
                        <Pressable
                          key={opt}
                          onPress={() => setForm(p => ({ ...p, type: opt }))}
                          className={`flex-1 py-3 rounded-[18px] items-center justify-center ${form.type === opt ? 'bg-white shadow-sm' : ''}`}
                        >
                          <ThemedText className={`text-sm font-bold ${form.type === opt ? 'text-orange-400' : 'text-gray-400'}`}>{opt}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Transaction Title */}
                  <View className="bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm mb-4">
                    <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">Transaction Title</ThemedText>
                    <View className="flex-row items-center gap-3">
                      <MaterialCommunityIcons name="label-variant-outline" size={24} color="#F97316" />
                      <TextInput
                        value={form.title}
                        onChangeText={(t) => setForm(p => ({ ...p, title: t }))}
                        className="text-lg font-black flex-1 p-0"
                        style={{ color: theme.text, height: 28 }}
                        placeholder="Short title for this spend"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  {/* Amount and Paid Via Cards */}
                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm h-32 justify-between">
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">Amount</ThemedText>
                      <View className="flex-row items-center gap-1">
                        <ThemedText className="text-2xl font-black text-orange-400">{CURRENCY_SYMBOL}</ThemedText>
                        <TextInput
                          value={form.amount}
                          onChangeText={(text) => setForm(p => ({ ...p, amount: text }))}
                          className="text-3xl font-black p-0 flex-1"
                          style={{ color: theme.text, height: 40 }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setIsModePickerVisible(true)}
                      className="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm h-32 justify-between"
                    >
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">Paid Via</ThemedText>
                      <View className="flex-row items-center gap-2">
                        <MaterialCommunityIcons name="cash-multiple" size={24} color="#8B5CF6" />
                        <ThemedText className="text-xl font-black" style={{ color: theme.text }}>{form.mode}</ThemedText>
                      </View>
                    </Pressable>
                  </View>

                  {/* Date Card */}
                  <Pressable
                    onPress={handleOpenDatePicker}
                    className="w-full bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 shadow-sm flex-row items-center justify-between"
                  >
                    <View>
                      <ThemedText className="text-[10px] font-bold text-gray-400 uppercase mb-2">Date & Time</ThemedText>
                      <View className="flex-row items-center gap-3">
                        <View className="h-10 w-10 rounded-xl bg-purple-50 items-center justify-center">
                          <MaterialCommunityIcons name="calendar-multiselect" size={20} color="#8B5CF6" />
                        </View>
                        <ThemedText className="text-base font-bold" style={{ color: theme.text }}>
                          {form.date}, {form.time}
                        </ThemedText>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#D1D5DB" />
                  </Pressable>
                </View>

                {/* NEEDS ATTENTION SECTION */}
                <View className="px-6 mb-8">
                  <ThemedText className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic mb-4">Needs Attention</ThemedText>

                  {/* Category Selection */}
                  <View className="relative mb-4">
                    <View className="absolute -top-3 right-4 z-10 bg-yellow-400 px-2 py-0.5 rounded-lg">
                      <ThemedText className="text-[8px] font-black text-black">Check this?</ThemedText>
                    </View>
                    <Pressable
                      onPress={() => setIsCategoryPickerVisible(true)}
                      className="w-full bg-[#FFFCF0] dark:bg-gray-800/50 rounded-[28px] p-4 border border-yellow-100 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-4">
                        <View className="h-12 w-12 rounded-2xl bg-orange-100 items-center justify-center">
                          <MaterialCommunityIcons name="car-outline" size={24} color="#F59E0B" />
                        </View>
                        <View>
                          <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">Category</ThemedText>
                          <ThemedText className="text-lg font-black" style={{ color: theme.text }}>{form.category}</ThemedText>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={24} color="#D1D5DB" />
                    </Pressable>
                  </View>


                </View>

                {/* More Details Collapsible */}
                <View className="px-6 mb-6">
                  <Pressable
                    onPress={() => setIsMoreDetailsExpanded(!isMoreDetailsExpanded)}
                    className="flex-row items-center justify-between py-4 border-b border-gray-50"
                  >
                    <View className="flex-row items-center gap-2">
                      <MaterialCommunityIcons name="tune-variant" size={20} color={theme.text} />
                      <ThemedText className="text-sm font-black opacity-60">More details</ThemedText>
                    </View>
                    <MaterialCommunityIcons
                      name={isMoreDetailsExpanded ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={theme.text}
                      className="opacity-40"
                    />
                  </Pressable>

                  {isMoreDetailsExpanded && (


                    <View className="mt-6 gap-6">



                      {/* Merchant and Currency */}
                      <View className="flex-row gap-4">
                        <View className="flex-1">
                          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Merchant</ThemedText>
                          <View className="bg-gray-50 dark:bg-gray-800/50 rounded-[24px] p-4 flex-row items-center gap-2">
                            <View className="h-6 w-6 rounded-lg bg-red-100 items-center justify-center">
                              <MaterialCommunityIcons name="storefront-outline" size={14} color="#EF4444" />
                            </View>
                            <TextInput
                              value={form.merchant}
                              onChangeText={(t) => setForm(p => ({ ...p, merchant: t }))}
                              className="text-sm font-black flex-1 p-0"
                              placeholder="Store Name"
                              style={{ color: theme.text }}
                            />
                          </View>
                        </View>
                        {/* <View className="flex-1">
                          <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Currency</ThemedText>
                          <View className="bg-gray-50 dark:bg-gray-800/50 rounded-[24px] p-4 flex-row items-center gap-3">
                            <ThemedText className="text-lg font-black text-gray-300">{CURRENCY_SYMBOL}</ThemedText>
                            <ThemedText className="text-sm font-black" style={{ color: theme.text }}>{form.currency}</ThemedText>
                          </View>
                        </View> */}
                      </View>

                      {/* Account Selection */}
                      <View className="relative mb-4">
                        <Pressable
                          onPress={() => setIsAccountPickerVisible(true)}
                          className="w-full bg-white dark:bg-gray-800 rounded-[28px] p-4 border border-gray-100 shadow-sm flex-row items-center justify-between"
                        >
                          <View className="flex-row items-center gap-4">
                            <View className="h-12 w-12 rounded-2xl bg-blue-50 items-center justify-center">
                              <MaterialCommunityIcons name="wallet-outline" size={24} color="#3B82F6" />
                            </View>
                            <View>
                              <ThemedText className="text-[10px] font-bold text-gray-400 uppercase">Paid from account</ThemedText>
                              <ThemedText className="text-base font-bold" style={{ color: theme.text }}>{form.account || 'Select account'}</ThemedText>
                            </View>
                          </View>
                          <MaterialCommunityIcons name="chevron-down" size={24} color="#D1D5DB" />
                        </Pressable>
                      </View>

                      {/* Tags */}
                      <View>
                        <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Tags</ThemedText>
                        <View className="flex-row flex-wrap gap-2">
                          {tagOptions.map((tag) => (
                            <Pressable
                              key={tag}
                              onPress={() => setForm(p => ({ ...p, tag }))}
                              className={`px-4 py-2 rounded-full border ${form.tag === tag ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}
                            >
                              <ThemedText className={`text-xs font-bold ${form.tag === tag ? 'text-orange-400' : 'text-gray-500'}`}>{tag}</ThemedText>
                            </Pressable>
                          ))}
                          <Pressable className="px-4 py-2 rounded-full border border-dashed border-gray-200 bg-white flex-row items-center gap-1">
                            <MaterialCommunityIcons name="plus" size={14} color="#D1D5DB" />
                            <ThemedText className="text-xs font-bold text-gray-300">Add Tag</ThemedText>
                          </Pressable>
                        </View>
                      </View>

                      {/* Notes */}
                      <View>
                        <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Notes</ThemedText>
                        <TextInput
                          multiline
                          placeholder="Add a description or note..."
                          placeholderTextColor="#D1D5DB"
                          value={form.notes}
                          onChangeText={(t) => setForm(p => ({ ...p, notes: t }))}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-[24px] p-5 text-sm min-h-[100px]"
                          textAlignVertical="top"
                          style={{ color: theme.text }}
                        />
                      </View>

                      {/* Document Attachment */}
                      <View>
                        <ThemedText className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 italic">Attach Document</ThemedText>
                        <Pressable
                          onPress={handlePickDocument}
                          className="w-full h-16 border-2 border-dashed border-gray-100 rounded-[24px] items-center justify-center flex-row gap-2 bg-gray-50/50"
                        >
                          {form.attachment ? (
                            <>
                              <MaterialCommunityIcons name="file-check-outline" size={20} color="#10B981" />
                              <ThemedText className="text-sm font-bold text-gray-600 line-clamp-1" numberOfLines={1}>
                                {form.attachment.split('/').pop()}
                              </ThemedText>
                              <Pressable onPress={() => setForm(prev => ({ ...prev, attachment: null }))} hitSlop={10}>
                                <MaterialCommunityIcons name="close-circle" size={16} color="#EF4444" />
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <MaterialCommunityIcons name="file-upload-outline" size={20} color="#6B7280" />
                              <ThemedText className="text-sm font-bold text-gray-400">Upload receipt or bill</ThemedText>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View className="px-6 gap-4">
                  <Pressable
                    onPress={handleConfirmEntry}
                    disabled={isSavingEntry}
                    style={{ backgroundColor: accent }}
                    className="w-full py-5 rounded-[24px] flex-row items-center justify-center gap-2 shadow-lg"
                  >
                    {isSavingEntry ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <ThemedText className="text-lg font-black text-white">Confirm & Save</ThemedText>
                        <MaterialCommunityIcons name="check-circle-outline" size={24} color="white" />
                      </>
                    )}
                  </Pressable>

                  {/* <Pressable
                    className="w-full py-5 rounded-[24px] border border-gray-100 bg-white items-center justify-center flex-row gap-2 shadow-sm"
                  >
                    <ThemedText className="text-lg font-bold text-gray-600">Edit voice input</ThemedText>
                    <MaterialCommunityIcons name="microphone-outline" size={20} color="#6B7280" />
                  </Pressable> */}

                  <Pressable onPress={handleCloseEdit} className="items-center py-2">
                    <ThemedText className="text-gray-400 font-bold">Cancel</ThemedText>
                  </Pressable>
                </View>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal >

      {
        Platform.OS === 'ios' && (
          <Modal
            transparent
            animationType="fade"
            visible={isDatePickerVisible}
            onRequestClose={handleCancelDatePicker}
          >
            <View className="flex-1 justify-end bg-black/30">
              <Pressable className="flex-1" onPress={handleCancelDatePicker} />
              <View
                className="rounded-t-3xl border px-4 pb-6 pt-4"
                style={{ backgroundColor: theme.background, borderColor: softBorder }}
              >
                <TText className="text-center text-base" style={bodyFont}>
                  Select Date & Time
                </TText>
                <DateTimePicker
                  value={pendingDate}
                  mode="datetime"
                  display="spinner"
                  onChange={handleIosDateChange}
                  themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                  style={{ width: '100%' }}
                />
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 items-center rounded-2xl border py-3"
                    style={{ borderColor: softBorder }}
                    onPress={handleCancelDatePicker}
                  >
                    <TText className="text-base" style={titleFont}>
                      Cancel
                    </TText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 items-center rounded-2xl py-3"
                    style={{ backgroundColor: accent }}
                    onPress={handleConfirmDatePicker}
                  >
                    <TText className="text-base text-white" style={titleFont}>
                      Set Date
                    </TText>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )
      }

      {/* Mode Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isModePickerVisible}
        onRequestClose={() => setIsModePickerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={() => setIsModePickerVisible(false)} />
          <View
            className="rounded-t-3xl border px-4 pb-10 pt-4"
            style={{ backgroundColor: theme.background, borderColor: softBorder }}
          >
            <ThemedText className="text-center text-lg font-bold mb-6" style={{ color: theme.text }}>
              Select Payment Method
            </ThemedText>
            <View className="gap-2">
              {modeOptions.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setForm(p => ({ ...p, mode }));
                    setIsModePickerVisible(false);
                  }}
                  className={`p-4 rounded-2xl flex-row items-center justify-between ${form.mode === mode ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialCommunityIcons
                      name={mode === 'Cash' ? 'cash' : mode === 'UPI' ? 'lightning-bolt' : mode === 'Credit Card' ? 'credit-card' : 'wallet'}
                      size={24}
                      color={form.mode === mode ? '#F97316' : '#94A3B8'}
                    />
                    <ThemedText className={`font-bold ${form.mode === mode ? 'text-orange-500' : 'text-gray-700'}`}>{mode}</ThemedText>
                  </View>
                  {form.mode === mode && <MaterialCommunityIcons name="check" size={20} color="#F97316" />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isCategoryPickerVisible}
        onRequestClose={() => setIsCategoryPickerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={() => setIsCategoryPickerVisible(false)} />
          <View
            className="rounded-t-3xl border px-4 pb-10 pt-4"
            style={{ backgroundColor: theme.background, borderColor: softBorder }}
          >
            <ThemedText className="text-center text-lg font-bold mb-6" style={{ color: theme.text }}>
              Select Category
            </ThemedText>
            <ScrollView style={{ maxHeight: 400 }}>
              <View className="flex-row flex-wrap gap-4 justify-between">
                {categoryOptions.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setForm(p => ({ ...p, category: cat }));
                      setIsCategoryPickerVisible(false);
                    }}
                    className={`w-[47%] p-4 rounded-3xl items-center gap-2 border ${form.category === cat ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-transparent'}`}
                  >
                    <View className={`h-12 w-12 rounded-2xl items-center justify-center ${form.category === cat ? 'bg-orange-100' : 'bg-white'}`}>
                      <MaterialCommunityIcons
                        name={cat === 'Food' ? 'silverware-fork-knife' : cat === 'Travel' ? 'airplane' : cat === 'Shopping' ? 'cart' : cat === 'Bills' ? 'file-document' : cat === 'Family/Gifts' ? 'heart' : 'dots-horizontal'}
                        size={24}
                        color={form.category === cat ? '#F97316' : '#94A3B8'}
                      />
                    </View>
                    <ThemedText className={`text-xs font-bold ${form.category === cat ? 'text-orange-500' : 'text-gray-700'}`}>{cat}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Account Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isAccountPickerVisible}
        onRequestClose={() => setIsAccountPickerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={() => setIsAccountPickerVisible(false)} />
          <View
            className="rounded-t-3xl border px-4 pb-10 pt-4"
            style={{ backgroundColor: theme.background, borderColor: softBorder }}
          >
            <ThemedText className="text-center text-lg font-bold mb-6" style={{ color: theme.text }}>
              Select Account
            </ThemedText>
            <View className="gap-2">
              {accountOptions.map((acc) => (
                <Pressable
                  key={acc}
                  onPress={() => {
                    setForm(p => ({ ...p, account: acc }));
                    setIsAccountPickerVisible(false);
                  }}
                  className={`p-4 rounded-2xl flex-row items-center justify-between ${form.account === acc ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialCommunityIcons
                      name={acc.includes('Credit') ? 'credit-card' : acc.includes('Wallet') ? 'wallet' : 'bank'}
                      size={24}
                      color={form.account === acc ? '#3B82F6' : '#94A3B8'}
                    />
                    <ThemedText className={`font-bold ${form.account === acc ? 'text-blue-500' : 'text-gray-700'}`}>{acc}</ThemedText>
                  </View>
                  {form.account === acc && <MaterialCommunityIcons name="check" size={20} color="#3B82F6" />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView >
  );
}

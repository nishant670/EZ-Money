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
  Animated,
  Dimensions,
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
import { TransactionFormModal, type EntryForm } from '@/components/transactions/TransactionFormModal';

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
  const defaultForm = useMemo(() => ({
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
    account: 'Main Account',
    merchant: '',
    attachment: null,
  }), []);

  const createBlankForm = useCallback((): EntryForm => ({
    ...defaultForm,
    merchant: '',
    notes: '',
  }), [defaultForm]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(defaultForm);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

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

  /* 
     handleConfirmEntry is now passed to TransactionFormModal.
     The internal UI helpers like handleOpenDatePicker are also moved to the Modal.
  */

  const handleConfirmEntry = useCallback(async (formData: EntryForm) => {
    setIsSavingEntry(true);
    try {
      let attachmentUrl = formData.attachment;

      // Upload attachment if it's a local file
      if (formData.attachment && (formData.attachment.startsWith('file://') || formData.attachment.startsWith('content://'))) {
        const uploadData = new FormData();
        const filename = formData.attachment.split('/').pop() || 'file';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'application/octet-stream';

        uploadData.append('file', {
          uri: formData.attachment,
          name: filename,
          type,
        } as any);

        const uploadRes = await fetch(`${API_BASE_URL}/v1/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: uploadData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          attachmentUrl = data.url;
        }
      }

      const parsedDate = parseDateLabel(formData.date);
      const trimmedTag = formData.tag.trim();
      const response = await fetch(`${API_BASE_URL}/v1/entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(formData.amount),
          type: formData.type.toLowerCase(),
          mode: formData.mode,
          category: formData.category,
          notes: formData.notes.trim(),
          date: parsedDate ? parsedDate.toISOString() : formData.date,
          tag: trimmedTag.length > 0 ? trimmedTag : null,
          account: formData.account,
          merchant: formData.merchant.trim(),
          title: formData.title.trim() || 'Untitled Transaction',
          time: formData.time,
          attachment: attachmentUrl,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to save the entry right now.');
      }
      await fetchEntries();
      setForm(createBlankForm());
      setIsEditOpen(false);
    } catch (error) {
      throw error; // Re-throw to be handled by the modal's internal error state if needed
    } finally {
      setIsSavingEntry(false);
    }
  }, [createBlankForm, fetchEntries, token]);

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
        const tagValue = data.tag ?? prev.tag;
        const newType = toTitleCase(data.type) ?? prev.type;
        return {
          ...prev,
          title: data.title ?? prev.title,
          amount: data.amount != null ? data.amount.toFixed(2) : prev.amount,
          time: data.time ?? prev.time,
          type: newType,
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
  }, [inputText, isSubmitting, recordedUri, token]);

  const handleOpenManualEntry = useCallback(() => {
    setForm(createBlankForm());
    setIsEditOpen(true);
  }, [createBlankForm]);

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

      <TransactionFormModal
        visible={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={form}
        onSave={handleConfirmEntry}
      />
    </SafeAreaView>
  );
}

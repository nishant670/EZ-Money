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
  const [formError, setFormError] = useState<string | null>(null);

  const handleQuickPromptSelect = useCallback((label: string) => {
    const blank = createBlankForm();
    const now = new Date();
    setForm({
      ...blank,
      title: label,
      amount: '50.00',
      date: formatDateLabel(now),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      mode: 'Cash',
      account: 'Main Account',
    });
    setIsEditOpen(true);
  }, [createBlankForm]);

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

  const sections = useMemo(() => groupTransactionsBySection(transactions), [transactions]);
  const visibleSections = useMemo(() => sections.slice(0, 3), [sections]);
  const hasTransactions = sections.length > 0;

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
    if (!recording) return;
    try {
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
        // Ignore
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

  const handleOpenManualEntry = useCallback(() => {
    setForm(createBlankForm());
    setIsEditOpen(true);
  }, [createBlankForm]);

  const handleConfirmEntry = useCallback(async (formData: EntryForm) => {
    setFormError(null);
    setIsSavingEntry(true);
    try {
      let attachmentUrl = formData.attachment;

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
      setFormError(error instanceof Error ? error.message : 'Unable to save your entry. Please try again.');
    } finally {
      setIsSavingEntry(false);
    }
  }, [createBlankForm, fetchEntries, token]);

  const handleSubmitPrompt = useCallback(async () => {
    if (isSubmitting) return;
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
      setIsEditOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while parsing.');
    } finally {
      setIsSubmitting(false);
    }
  }, [inputText, recordedUri, token, normalizeDateLabel]);

  const renderTransactionItem = (item: Transaction) => {
    const isIncome = item.entryType === 'income';
    const displayAmount = Math.abs(item.amount).toFixed(2);
    const dateStr = item.dateLabel || 'Today';

    return (
      <TransactionItem
        key={item.id}
        title={item.name}
        //@ts-ignore
        icon={item.icon}
        //@ts-ignore
        category={item.category}
        subtitle={`${item.category} • ${item.mode}`}
        amount={displayAmount}
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

  const renderRecentActivity = () => {
    if (isEntriesLoading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator color={accent} />
          <ThemedText className="mt-2 text-gray-400 font-medium">Loading activity...</ThemedText>
        </View>
      );
    }

    if (!hasTransactions) {
      return (
        <View className="items-center py-10 bg-white/40 dark:bg-gray-800/40 rounded-[32px] border border-dashed border-gray-200 dark:border-gray-700 mx-6">
          <MaterialCommunityIcons name="receipt" size={48} color={theme.text} opacity={0.1} />
          <ThemedText className="mt-4 text-gray-400 font-bold text-center">No activity yet.{"\n"}Try recording a spend!</ThemedText>
        </View>
      );
    }

    return (
      <View>
        <View className="flex-row items-center justify-between px-6 mb-4">
          <ThemedText className="text-xl font-black" style={{ color: theme.text }}>Recent Activity</ThemedText>
          <Pressable onPress={() => router.push('/transactions')}>
            <ThemedText className="font-bold" style={{ color: theme.accent }}>See All</ThemedText>
          </Pressable>
        </View>

        {visibleSections.map((section) => (
          <View key={section.title} className="mb-6">
            <ThemedText className="px-6 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{section.title}</ThemedText>
            <View className="px-6 gap-3">
              {section.data.map((item) => renderTransactionItem(item))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <HomeHeader />

        <View className="px-6 pb-6">
          <ThemedText className="text-3xl font-black leading-tight text-center" style={{ color: theme.text }}>What did you do today?</ThemedText>
          <ThemedText className="text-sm text-gray-500 mt-2 font-medium text-center">Let's track your ins and outs!</ThemedText>
        </View>

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

        <QuickPrompts
          onSelect={handleQuickPromptSelect}
          onAdd={() => console.log('Add quick prompt pressed')}
        />

        {errorMessage && (
          <View className="mx-6 mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
            <ThemedText className="text-red-500 dark:text-red-400 text-center font-bold">{errorMessage}</ThemedText>
          </View>
        )}

        {renderRecentActivity()}

        <View className="h-32" />
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={handleOpenManualEntry}
        style={[{ backgroundColor: theme.accent }, cardShadow]}
        className="h-16 w-16 rounded-full items-center justify-center absolute bottom-10 right-6 elevation-5"
      >
        <MaterialCommunityIcons name="plus" size={32} color="white" />
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

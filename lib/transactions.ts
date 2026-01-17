import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { Transaction } from '@/types/transaction';

export type ApiEntry = {
  id?: string;
  amount?: number | string;
  type?: string;
  mode?: string;
  category?: string;
  date?: string;
  notes?: string;
  merchant?: string;
  title?: string;
  tag?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
};

const monthLookup: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const toTitleCase = (value?: string | null) => {
  if (!value) {
    return value ?? null;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const formatDateLabel = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export const parseDateLabel = (label?: string | null) => {
  if (!label) {
    return null;
  }
  const parsed = new Date(label);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const match = label.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const [, dayStr, monthStr, yearStr] = match;
    const monthIndex = monthLookup[monthStr.toLowerCase()];
    if (monthIndex != null) {
      const day = Number(dayStr);
      const year = Number(yearStr);
      const fallback = new Date(year, monthIndex, day);
      if (!Number.isNaN(fallback.getTime())) {
        return fallback;
      }
    }
  }
  return null;
};

export const normalizeDateLabel = (value?: string | null, fallback?: string) => {
  const parsed = parseDateLabel(value);
  if (parsed) {
    return formatDateLabel(parsed);
  }
  return value ?? fallback ?? formatDateLabel(new Date());
};

const categoryIconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  food: 'coffee-outline',
  travel: 'airplane',
  shopping: 'cart-outline',
  bills: 'file-document-outline',
  'family/gifts': 'gift-outline',
  misc: 'dots-horizontal',
  income: 'cash-multiple',
  entertainment: 'play-box-multiple-outline',
};

export const resolveIconForEntry = (category?: string | null, type?: string | null) => {
  const normalizedCategory = category?.toLowerCase().trim();
  if (normalizedCategory && categoryIconMap[normalizedCategory]) {
    return categoryIconMap[normalizedCategory];
  }
  if (type?.toLowerCase() === 'income') {
    return 'cash-multiple';
  }
  return 'swap-horizontal';
};

const deriveSectionMeta = (value?: string | null) => {
  const parsed = parseDateLabel(value);
  const fallback = value ? new Date(value) : null;
  const resolved =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : fallback && !Number.isNaN(fallback.getTime())
        ? fallback
        : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (resolved) {
    const entryDay = new Date(resolved.getFullYear(), resolved.getMonth(), resolved.getDate());
    const diffDays = Math.round((todayStart.getTime() - entryDay.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      return { section: 'Today', timestamp: entryDay.getTime() };
    }
    if (diffDays === 1) {
      return { section: 'Yesterday', timestamp: entryDay.getTime() };
    }
    return { section: formatDateLabel(entryDay), timestamp: entryDay.getTime() };
  }
  return { section: 'Recent', timestamp: todayStart.getTime() };
};

const safeNumber = (value?: number | string | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const normalizeEntriesResponse = (payload: unknown): ApiEntry[] => {
  if (Array.isArray(payload)) {
    return payload as ApiEntry[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.entries)) {
      return record.entries as ApiEntry[];
    }
    if (Array.isArray(record.data)) {
      return record.data as ApiEntry[];
    }
  }
  return [];
};

export const mapEntryToTransaction = (entry: ApiEntry): Transaction => {
  const amountValue = safeNumber(entry.amount);
  const type = (entry.type ?? 'Expense').toLowerCase();
  const normalizedType: 'income' | 'expense' = type === 'income' ? 'income' : 'expense';
  const signedAmount = normalizedType === 'income' ? Math.abs(amountValue) : -Math.abs(amountValue);
  const label =
    entry.title?.trim() || entry.merchant?.trim() || entry.category?.trim() || entry.notes?.trim() || entry.mode || 'Transaction';
  const category = entry.category ?? (normalizedType === 'income' ? 'Income' : 'Expense');
  const dateSource =
    entry.date ?? entry.created_at ?? entry.createdAt ?? entry.updated_at ?? null;
  const formattedDate = dateSource ? normalizeDateLabel(dateSource) : null;
  const { section, timestamp } = deriveSectionMeta(dateSource);
  const normalizedTag = entry.tag ? toTitleCase(entry.tag) ?? entry.tag : null;

  return {
    id: entry.id ? String(entry.id) : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: label,
    title: entry.title ?? null,
    category,
    amount: signedAmount,
    icon: resolveIconForEntry(category, entry.type),
    section,
    occurredAt: timestamp,
    entryType: normalizedType,
    mode: entry.mode ?? null,
    notes: entry.notes ?? null,
    merchant: entry.merchant ?? null,
    dateLabel: formattedDate,
    rawDate: dateSource ?? null,
    tag: normalizedTag,
  };
};

const resolveApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest?.hostUri ??
    Constants.manifest?.debuggerHost ??
    null;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:8080`;
    }
  }

  return 'http://127.0.0.1:8080';
};

export const API_BASE_URL = resolveApiBaseUrl();

export const loadTransactions = async (token?: string | null): Promise<Transaction[]> => {
  if (!token) {
    return [];
  }
  const response = await fetch(`${API_BASE_URL}/v1/entries`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to load entries right now.');
  }
  const payload = await response.json();
  const mapped = normalizeEntriesResponse(payload).map(mapEntryToTransaction);
  mapped.sort((a, b) => (b.occurredAt ?? 0) - (a.occurredAt ?? 0));
  return mapped;
};

export const groupTransactionsBySection = (transactions: Transaction[]) => {
  if (transactions.length === 0) {
    return [];
  }
  const grouped: Record<string, Transaction[]> = {};
  transactions.forEach((transaction) => {
    if (!grouped[transaction.section]) {
      grouped[transaction.section] = [];
    }
    grouped[transaction.section].push(transaction);
  });
  return Object.entries(grouped)
    .map(([title, data]) => ({
      title,
      data: data.sort((a, b) => (b.occurredAt ?? 0) - (a.occurredAt ?? 0)),
      sortValue:
        title === 'Today'
          ? Number.MAX_SAFE_INTEGER
          : title === 'Yesterday'
            ? Number.MAX_SAFE_INTEGER - 1
            : data[0]?.occurredAt ?? 0,
    }))
    .sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0))
    .map(({ sortValue, ...rest }) => rest);
};

// The legacy entry point, which is what the rest of the app uses: SDK 54 moved
// `documentDirectory` and `writeAsStringAsync` behind `expo-file-system/legacy`
// and the new `File`/`Directory` API is a different shape. One of the two, and
// this is the one `split.tsx` and `edit-profile.tsx` already share.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { getClientTimeZone } from './datetime';
import { readApiError } from './api-error';
import { API_BASE_URL, type TransactionFilters } from './transactions';

export type ExportFormat = 'csv' | 'pdf';

const EXPORT_MEDIA: Record<ExportFormat, { mimeType: string; uti: string; extension: string }> = {
  csv: {
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    extension: 'csv',
  },
  pdf: {
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
    extension: 'pdf',
  },
};

/**
 * The filters that describe *which rows*, as opposed to how they are displayed.
 *
 * `sort`, `page` and `page_size` are the list screen's own concerns — an export
 * that honoured `page_size` would hand over the fifty rows that happened to be
 * on screen and call it "your transactions". The server caps the row count
 * separately and says so, which is the honest version of the same limit.
 */
const exportableFilters = (filters?: TransactionFilters) => {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'sort' || key === 'page' || key === 'page_size') return;
      if (value != null && value !== '' && value !== 'All') {
        params.append(key, String(value));
      }
    });
  }
  return params;
};

/** `Finnri transactions 2026-08-15.csv` — a name that means something in a file list. */
const exportFileName = (format: ExportFormat) => {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const label = format === 'pdf' ? 'statement' : 'transactions';
  return `finnri-${label}-${stamp}.${EXPORT_MEDIA[format].extension}`;
};

/**
 * Download an export and hand it to the OS share sheet.
 *
 * The file is written to the app's document directory first rather than being
 * shared as text, because a share sheet given a *file* offers every app that
 * can open one — Drive, mail, WhatsApp, the printer — while a share sheet given
 * a string offers only the ones that take text. That difference is the whole
 * point of the task's third bullet.
 *
 * A PDF is bytes, so it is written base64: `writeAsStringAsync` in UTF-8 would
 * mangle every byte outside the ASCII range and produce a file no reader will
 * open.
 */
export const shareTransactionExport = async (
  token: string,
  format: ExportFormat,
  filters?: TransactionFilters
): Promise<void> => {
  const params = exportableFilters(filters);
  params.append('format', format);
  params.append('tz', getClientTimeZone());

  const response = await fetch(`${API_BASE_URL}/v1/entries/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw await readApiError(response, 'Unable to export these transactions.');
  }

  const media = EXPORT_MEDIA[format];
  const fileName = exportFileName(format);

  // No document directory means no file to share, which is a real state on some
  // Android configurations rather than a failure — CSV degrades to sharing its
  // own text, and a PDF has nothing honest to degrade to.
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!FileSystem.documentDirectory || !sharingAvailable) {
    if (format === 'csv') {
      await Share.share({ title: fileName, message: await response.text() });
      return;
    }
    throw new Error('Sharing is unavailable on this device, so the PDF cannot be saved.');
  }

  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  if (format === 'pdf') {
    const buffer = await response.arrayBuffer();
    await FileSystem.writeAsStringAsync(fileUri, base64FromBytes(new Uint8Array(buffer)), {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.writeAsStringAsync(fileUri, await response.text(), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: media.mimeType,
    UTI: media.uti,
    dialogTitle: fileName,
  });
};

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Bytes to base64, without `Buffer` or `btoa`.
 *
 * Hermes has neither: `Buffer` is Node's and is not polyfilled, and `btoa`
 * takes a binary *string*, which means building a megabyte-long string out of
 * char codes before encoding it. Twenty lines here is cheaper than a dependency
 * and cheaper than that intermediate string.
 */
export const base64FromBytes = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64_ALPHABET[a >> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : BASE64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : BASE64_ALPHABET[c & 63];
  }
  return out;
};

import { readApiError } from './api-error';
import { API_BASE_URL } from './transactions';

const uploadFieldLabels: Record<string, string> = {
  file: 'Receipt',
};

// The backend sniffs the actual bytes and ignores whatever type we declare, so
// this map only needs to be good enough for the multipart part header.
const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heic',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export const ATTACHMENT_PICKER_TYPES = ['image/*', 'application/pdf'];

/**
 * A picked-but-not-yet-uploaded file still points at local device storage.
 * Anything else is already a URL the backend gave us.
 */
export const isLocalAttachmentUri = (value: string | null | undefined): boolean =>
  !!value && (value.startsWith('file://') || value.startsWith('content://'));

export const isPdfAttachment = (value: string | null | undefined): boolean =>
  !!value && value.split('?')[0].toLowerCase().endsWith('.pdf');

const attachmentFileName = (uri: string): string => {
  const fromPath = uri.split('?')[0].split('/').pop();
  return fromPath && fromPath.length > 0 ? decodeURIComponent(fromPath) : 'receipt';
};

const attachmentMimeType = (name: string, declared?: string | null): string => {
  if (declared && declared.includes('/')) {
    return declared;
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return mimeByExtension[extension] ?? 'application/octet-stream';
};

/**
 * Uploads a locally picked receipt and resolves to the hosted URL to persist on
 * the entry. Throws on failure — callers must not fall back to storing the
 * local URI, which would be meaningless on any other device.
 */
export const uploadAttachment = async (
  token: string,
  uri: string,
  declaredMimeType?: string | null
): Promise<string> => {
  const name = attachmentFileName(uri);
  const body = new FormData();

  // Note: no explicit Content-Type header below. React Native fills it in with
  // the multipart boundary, and setting it by hand drops the boundary and makes
  // the request unparseable on the server.
  body.append('file', {
    uri,
    name,
    type: attachmentMimeType(name, declaredMimeType),
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/v1/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (!response.ok) {
    throw await readApiError(response, 'Unable to upload that receipt right now.', uploadFieldLabels);
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error('Unable to upload that receipt right now.');
  }
  return data.url;
};

/**
 * Resolves the value to persist on an entry: uploads first if the user picked a
 * new local file, otherwise passes through the existing URL (or null).
 */
export const resolveAttachmentForSave = async (
  token: string,
  attachment: string | null
): Promise<string | null> => {
  if (!attachment) {
    return null;
  }
  if (!isLocalAttachmentUri(attachment)) {
    return attachment;
  }
  return uploadAttachment(token, attachment);
};

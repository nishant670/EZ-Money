import { getClientTimeZone } from './datetime';
import { API_BASE_URL } from './transactions';

export type ParseResponse = {
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
  note: string | null;
  date: string | null;
  source_text: string | null;
  recurring_candidate?: boolean | null;
  split_candidate?: boolean | null;
  confidence?: Record<string, number>;
  needs_confirmation?: Record<string, boolean>;
  missing_fields?: string[];
  clarifications?: string[];
};

export type ParseDraftInput = {
  token?: string | null;
  hintText?: string;
  audio?: {
    uri: string;
    name: string;
    type: string;
  };
  tz?: string;
};

export const parseEntryDraft = async ({
  token,
  hintText,
  audio,
  tz = getClientTimeZone(),
}: ParseDraftInput): Promise<ParseResponse> => {
  const formData = new FormData();
  const trimmedHint = hintText?.trim() ?? '';
  if (trimmedHint) {
    formData.append('hint_text', trimmedHint);
  }
  if (audio) {
    formData.append('audio', audio as unknown as Blob);
  }
  formData.append('tz', tz);

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
  return response.json();
};

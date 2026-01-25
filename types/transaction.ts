import { MaterialCommunityIcons } from '@expo/vector-icons';

export type Transaction = {
  id: string;
  name: string;
  title?: string | null;
  category: string;
  amount: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  bgColor?: string;
  section: string;
  occurredAt?: number;
  entryType?: 'income' | 'expense';
  mode?: string | null;
  notes?: string | null;
  merchant?: string | null;
  dateLabel?: string | null;
  rawDate?: string | null;
  tag?: string | null;
};

import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Canonical transaction categories — the single source of truth for the app.
 *
 * This must stay in step with `canonicalCategories` in the backend's
 * `internal/http/categories.go`, the enum in `schemas/expense_entry.schema.json`,
 * and `internal/ai/prompt.txt`.
 *
 * These drifted once: the app added "Food & Drinks" and "Transport" to its
 * picker while the parser still only knew the original six, so every
 * AI-captured meal was filed as "Food" and every auto rickshaw as "Travel",
 * while manual entries used the newer names. The same spend ended up split
 * across two keys and every rollup quietly stopped being true.
 *
 * Transport and Travel are deliberately separate. Transport is getting around
 * day to day — autos, cabs, the metro, fuel. Travel is going somewhere —
 * flights, hotels, a trip.
 */
export const CATEGORIES = [
  'Food & Drinks',
  'Transport',
  'Travel',
  'Shopping',
  'Bills',
  'Entertainment',
  'Family/Gifts',
  'Misc',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Confirm-first fallback when the category is unknown. */
export const DEFAULT_CATEGORY: Category = 'Misc';

export type CategoryVisual = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bgColor: string;
};

/** One icon and colour per canonical category, keyed lowercase. */
export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  'food & drinks': { icon: 'silverware-fork-knife', color: '#D4A017', bgColor: '#FFF9C4' },
  transport: { icon: 'bus', color: '#E57373', bgColor: '#FFEBEE' },
  travel: { icon: 'airplane', color: '#7E57C2', bgColor: '#EDE7F6' },
  shopping: { icon: 'cart-outline', color: '#42A5F5', bgColor: '#E3F2FD' },
  bills: { icon: 'file-document-outline', color: '#26A69A', bgColor: '#E0F2F1' },
  entertainment: { icon: 'play-circle-outline', color: '#5C6BC0', bgColor: '#E8EAF6' },
  'family/gifts': { icon: 'gift-outline', color: '#EC407A', bgColor: '#FCE4EC' },
  misc: { icon: 'dots-horizontal', color: '#90A4AE', bgColor: '#F5F5F5' },
};

/** Income has no category of its own; it is rendered from the entry type. */
export const INCOME_VISUAL: CategoryVisual = {
  icon: 'briefcase-outline',
  color: '#FF7043',
  bgColor: '#F3E5F5',
};

export const UNKNOWN_VISUAL: CategoryVisual = {
  icon: 'swap-horizontal',
  color: '#90A4AE',
  bgColor: '#F5F5F5',
};

/**
 * Legacy and loose names still readable from older rows and older app builds.
 * Mirrors `categoryAliases` on the backend.
 */
const CATEGORY_ALIASES: Record<string, Category> = {
  food: 'Food & Drinks',
  'food & drink': 'Food & Drinks',
  'food and drinks': 'Food & Drinks',
  dining: 'Food & Drinks',
  restaurant: 'Food & Drinks',
  groceries: 'Food & Drinks',
  grocery: 'Food & Drinks',
  cafe: 'Food & Drinks',
  coffee: 'Food & Drinks',
  transportation: 'Transport',
  commute: 'Transport',
  cab: 'Transport',
  taxi: 'Transport',
  metro: 'Transport',
  fuel: 'Transport',
  petrol: 'Transport',
  trip: 'Travel',
  vacation: 'Travel',
  flight: 'Travel',
  hotel: 'Travel',
  lodging: 'Travel',
  movies: 'Entertainment',
  streaming: 'Entertainment',
  games: 'Entertainment',
  music: 'Entertainment',
  // The old subscription-only vocabulary; these are recurring service bills.
  productivity: 'Bills',
  cloud: 'Bills',
  membership: 'Bills',
  learning: 'Bills',
  family: 'Family/Gifts',
  gifts: 'Family/Gifts',
  gift: 'Family/Gifts',
  miscellaneous: 'Misc',
  other: 'Misc',
  finance: 'Misc',
  split: 'Misc',
};

/** Resolves a raw value to its canonical form, or null when unrecognised. */
export const resolveCategory = (value?: string | null): Category | null => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) {
    return null;
  }
  const exact = CATEGORIES.find((category) => category.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }
  return CATEGORY_ALIASES[normalized] ?? null;
};

/**
 * The picker list. An unrecognised category from an older row is appended so
 * editing that entry never silently rewrites it.
 */
export const categoryOptionsFor = (current?: string | null): string[] => {
  const resolved = resolveCategory(current);
  if (resolved || !current?.trim()) {
    return [...CATEGORIES];
  }
  return [...CATEGORIES, current.trim()];
};

/** Icon and colour for a category, falling back to income or unknown. */
export const categoryVisual = (
  category?: string | null,
  type?: string | null
): CategoryVisual => {
  const resolved = resolveCategory(category);
  if (resolved) {
    return CATEGORY_VISUALS[resolved.toLowerCase()];
  }
  if (type?.toLowerCase() === 'income') {
    return INCOME_VISUAL;
  }
  return UNKNOWN_VISUAL;
};

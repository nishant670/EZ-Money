/**
 * Ranking for the AI draft review sheet.
 *
 * The parser already tells us how sure it was — per-field confidence, an
 * explicit `needs_confirmation` map and a list of fields it could not fill at
 * all — but the sheet used to render every field identically, so a guessed
 * category looked exactly like a quoted amount. This module turns that
 * metadata into three buckets: what to put in front of the user, what to fold
 * into one summary line, and what is only worth showing if they go looking.
 *
 * It is deliberately pure. The sheet pins the result to the moment the draft
 * arrived, because re-ranking on every keystroke would move a card out from
 * under the finger that is editing it.
 */

export type DraftFieldKey =
  | 'amount'
  | 'type'
  | 'title'
  | 'category'
  | 'mode'
  | 'account'
  | 'date'
  | 'merchant'
  | 'tag'
  | 'notes';

/**
 * Display order for anything that is not sorted by confidence. Roughly "what
 * the transaction is" before "how it was paid" before "extra detail".
 */
export const DRAFT_FIELD_ORDER: readonly DraftFieldKey[] = [
  'amount',
  'type',
  'title',
  'category',
  'mode',
  'account',
  'date',
  'merchant',
  'tag',
  'notes',
];

/**
 * Below this the parser was guessing. Same threshold the sheet has always used
 * for its amber highlight — this module did not invent a second one.
 */
export const LOW_CONFIDENCE = 0.7;

/**
 * Fields the sheet refuses to save without, mirroring `requiredFields` in
 * `TransactionFormModal`. A blank one is a gap whether or not the parser owned
 * up to it, so it is flagged either way — otherwise the user meets
 * "Please provide Transaction Title" with the title folded inside a collapsed
 * summary and no obvious way to reach it.
 */
const REQUIRED_FIELDS: readonly DraftFieldKey[] = [
  'amount',
  'type',
  'title',
  'category',
  'mode',
  'date',
];

/**
 * The parser speaks snake_case and names a few things differently from the
 * form. `time` folds into `date` because one card shows both, and
 * `card_network` folds into `mode` because it only ever qualifies one.
 */
const FIELD_ALIASES: Record<string, DraftFieldKey> = {
  amount: 'amount',
  currency: 'amount',
  type: 'type',
  title: 'title',
  category: 'category',
  mode: 'mode',
  card_network: 'mode',
  account: 'account',
  accountid: 'account',
  account_hint: 'account',
  date: 'date',
  time: 'date',
  merchant: 'merchant',
  tag: 'tag',
  tags: 'tag',
  note: 'notes',
  notes: 'notes',
};

/**
 * A parser field name as a form field, or null for something this sheet does
 * not render as a card (`split_candidate`, `source_text`, …).
 */
export const normalizeDraftField = (field: string): DraftFieldKey | null =>
  FIELD_ALIASES[field.trim().toLowerCase()] ?? null;

export type DraftFieldValues = Partial<Record<DraftFieldKey, string>>;

export type DraftReviewInput = {
  confidence?: Record<string, number>;
  needsConfirmation?: Record<string, boolean>;
  missingFields?: string[];
  /** What the draft actually filled in. Blank means the parser left it empty. */
  values: DraftFieldValues;
};

export type DraftReviewPlan = {
  /** Needs a human look, least confident first. */
  flagged: DraftFieldKey[];
  /** Filled and trusted — these collapse into the summary line. */
  confident: DraftFieldKey[];
  /** Empty and optional. Only shown once the summary is opened. */
  optional: DraftFieldKey[];
};

const hasValue = (value?: string) => (value ?? '').trim().length > 0;

export const buildDraftReviewPlan = ({
  confidence,
  needsConfirmation,
  missingFields,
  values,
}: DraftReviewInput): DraftReviewPlan => {
  /** Field → the worst score anything said about it. Missing counts as zero. */
  const scores = new Map<DraftFieldKey, number>();
  const flag = (field: string, score: number) => {
    const key = normalizeDraftField(field);
    if (!key) return;
    const current = scores.get(key);
    if (current === undefined || score < current) {
      scores.set(key, score);
    }
  };

  (missingFields ?? []).forEach((field) => flag(field, 0));
  Object.entries(needsConfirmation ?? {}).forEach(([field, needs]) => {
    if (needs) flag(field, 0);
  });
  Object.entries(confidence ?? {}).forEach(([field, score]) => {
    if (typeof score === 'number' && score < LOW_CONFIDENCE) flag(field, score);
  });
  REQUIRED_FIELDS.forEach((key) => {
    if (!hasValue(values[key])) flag(key, 0);
  });

  // Filtering in canonical order first means the sort — which is stable — uses
  // that order as its tie-break, so two equally uncertain fields still read in
  // a sensible sequence.
  const flagged = DRAFT_FIELD_ORDER.filter((key) => scores.has(key)).sort(
    (a, b) => (scores.get(a) ?? 0) - (scores.get(b) ?? 0)
  );
  const confident = DRAFT_FIELD_ORDER.filter(
    (key) => !scores.has(key) && hasValue(values[key])
  );
  const optional = DRAFT_FIELD_ORDER.filter(
    (key) => !scores.has(key) && !hasValue(values[key])
  );

  return { flagged, confident, optional };
};

/**
 * What the summary line reads across, in the order it reads: how it was paid,
 * what it was, when, and who took the money.
 *
 * `amount` and `type` are missing on purpose — both are already the headline
 * above this line, and repeating them would spend the line's width on the one
 * thing nobody has to hunt for.
 */
const SUMMARY_ORDER: readonly DraftFieldKey[] = [
  'mode',
  'category',
  'date',
  'merchant',
  'title',
  'account',
  'tag',
];

const SUMMARY_LIMIT = 4;

/**
 * "UPI · Food & Drinks · Yesterday · DMart".
 *
 * Merchant and title routinely say the same thing ("DMart" and "DMart
 * groceries"), so a part that contains — or is contained by — one already
 * taken is dropped rather than shown twice.
 */
export const draftSummaryParts = (
  confident: DraftFieldKey[],
  values: DraftFieldValues,
  limit = SUMMARY_LIMIT
): string[] => {
  const parts: string[] = [];
  SUMMARY_ORDER.forEach((key) => {
    if (parts.length >= limit || !confident.includes(key)) return;
    const value = (values[key] ?? '').trim();
    if (!value) return;
    const lower = value.toLowerCase();
    const duplicate = parts.some((part) => {
      const taken = part.toLowerCase();
      return taken.includes(lower) || lower.includes(taken);
    });
    if (!duplicate) parts.push(value);
  });
  return parts;
};

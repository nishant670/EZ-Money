/**
 * What to call the current user on screen.
 *
 * A guest account is named by the backend — `Guest_59d8f84f`, a UUID slice that
 * has to be unique across every device that has ever opened the app. It is a
 * perfectly good key and a terrible greeting: "Hey there, Guest_59d8f84f!" is
 * the app reading its own database out loud.
 *
 * This is a display concern only. Nothing here is ever sent back, so the
 * username the API stores and matches on is untouched — the same account,
 * introduced properly.
 */

/**
 * The shape the backend generates: `"Guest_" + uuid[:8]`, per
 * `internal/http/auth.go`. Matching the *pattern* rather than `is_guest` is
 * deliberate — a guest who sets a real name in Edit Profile is still a guest,
 * and that name is the one they chose.
 */
const GENERATED_GUEST_NAME = /^guest[_-][0-9a-f]{4,}$/i;

export const isGeneratedGuestName = (name?: string | null) =>
  GENERATED_GUEST_NAME.test((name ?? '').trim());

/** The name to print, or `fallback` when there is no name worth printing. */
export const userDisplayName = (name?: string | null, fallback = 'Guest') => {
  const trimmed = (name ?? '').trim();
  return !trimmed || isGeneratedGuestName(trimmed) ? fallback : trimmed;
};

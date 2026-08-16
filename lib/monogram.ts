/**
 * Initials for the profile monogram.
 *
 * This replaced a shipped illustration — the same cartoon face on every
 * account, which is decoration pretending to be identity. Two letters of the
 * user's own name are not decoration: they change when the name does, and they
 * tell two accounts apart on a shared device.
 */
export const getMonogram = (name?: string | null, fallback = 'F') => {
  // Whitespace only. Splitting on every non-letter turns the generated guest
  // name `Guest_847550b7` into "G8", which reads like a seat number.
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  // By code point, not by code unit: `.slice(0, 1)` on a name that opens with
  // an emoji or any other astral character returns half a surrogate pair,
  // which renders as the replacement glyph.
  const initial = (word: string) => [...word][0] ?? '';

  if (words.length === 0) return fallback;
  if (words.length === 1) return initial(words[0]).toUpperCase();
  return (initial(words[0]) + initial(words[words.length - 1])).toUpperCase();
};

/**
 * Turning what the microphone reports into something a ring can be drawn from.
 *
 * `expo-audio` reports `metering` in dBFS on both platforms — `averagePower`
 * on iOS, `20·log10(maxAmplitude / 32767)` on Android — so the range is
 * roughly -160 (digital silence) to 0 (clipping), logarithmic, and negative.
 * None of that can be fed to a scale factor directly.
 *
 * The two ends are not equally interesting. Everything below `SILENCE_DB` is
 * room tone, and a linear map of the full -160..0 range would park normal
 * speech somewhere above 0.85 with nothing left to show for a raised voice —
 * the meter would look pinned, which is the same as looking dead. So a narrow
 * band gets the whole 0..1.
 *
 * ## Where the band came from
 *
 * Measured, not guessed — and the first guess was wrong. 495 samples off the
 * test handset put an ordinary quiet room at a median of **-25.6 dBFS**, with
 * a 10th percentile of -28.8 and a peak of -1.9. The floor started at -45,
 * which mapped that resting room tone to 0.45: the rings would have sat
 * half-lit with nobody speaking, and a voice would have moved them by a
 * quarter of their travel. Decorative again, one layer down.
 *
 * -35 is chosen against those numbers. Room tone lands near 0.2 — visibly
 * alive but plainly idle — and speech has the top two thirds to itself.
 *
 * Android biases this band high on its own: `metering` there is the *peak*
 * since the last read rather than an average, so its quiet is louder than
 * iOS's quiet for the same room. A floor tuned on iOS would leave Android
 * pinned, which is the direction that matters, since the same code has to read
 * honestly on both.
 */

/** Below this, treat it as the room rather than the user. */
export const SILENCE_DB = -35;

/**
 * Speech peaks well short of clipping, and requiring 0 dBFS for a full ring
 * would mean the ring never fills. Anything above this reads as loud.
 */
export const LOUD_DB = -5;

/**
 * dBFS → 0..1, clamped.
 *
 * `undefined` is the honest answer to "how loud is it" before metering is
 * enabled, between `prepareToRecordAsync` and the first sample, or when the
 * platform declines to report — it maps to 0 rather than throwing, because a
 * quiet ring is a better failure than a crash on the core loop.
 */
export function normalizeMeteringDb(db: number | null | undefined): number {
  if (db === null || db === undefined || Number.isNaN(db)) return 0;
  if (db <= SILENCE_DB) return 0;
  if (db >= LOUD_DB) return 1;
  return (db - SILENCE_DB) / (LOUD_DB - SILENCE_DB);
}

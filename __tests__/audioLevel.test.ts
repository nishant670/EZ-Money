import { LOUD_DB, SILENCE_DB, normalizeMeteringDb } from '@/lib/audio-level';

describe('normalizeMeteringDb', () => {
  it('reports silence for the values the platforms use for it', () => {
    // Android returns exactly -160 when maxAmplitude is 0; iOS parks around it.
    expect(normalizeMeteringDb(-160)).toBe(0);
    expect(normalizeMeteringDb(SILENCE_DB)).toBe(0);
    expect(normalizeMeteringDb(-45)).toBe(0);
  });

  it('reports a full ring at and above the loud threshold', () => {
    expect(normalizeMeteringDb(LOUD_DB)).toBe(1);
    expect(normalizeMeteringDb(0)).toBe(1);
    // Metering can overshoot 0 dBFS momentarily on a clipped sample.
    expect(normalizeMeteringDb(3)).toBe(1);
  });

  it('leaves a real room resting low and gives speech the rest of the range', () => {
    // Anchored to what the test handset actually reported: a quiet room sits
    // around -29 to -25 dBFS and peaks reach -2. Both failure modes are real —
    // a floor at -45 parked that room tone at 0.45 (rings half-lit with nobody
    // speaking), and mapping the raw -160..0 range parks speech above 0.85.
    const quietRoom = normalizeMeteringDb(-29);
    const conversational = normalizeMeteringDb(-20);
    const loud = normalizeMeteringDb(-8);

    expect(quietRoom).toBeLessThan(0.25);
    expect(conversational).toBeGreaterThan(0.4);
    expect(conversational).toBeLessThan(0.65);
    expect(loud).toBeGreaterThan(0.85);
    expect(quietRoom).toBeLessThan(conversational);
    expect(conversational).toBeLessThan(loud);
  });

  it('rises monotonically across the band', () => {
    const samples = [-35, -30, -25, -20, -15, -10, -5].map(normalizeMeteringDb);
    samples.forEach((value, index) => {
      if (index === 0) return;
      expect(value).toBeGreaterThan(samples[index - 1]);
    });
  });

  it('treats a missing reading as silence rather than throwing', () => {
    // `metering` is absent before the first sample, and on any platform that
    // declines to report it. A quiet ring beats a crash on the core loop.
    expect(normalizeMeteringDb(undefined)).toBe(0);
    expect(normalizeMeteringDb(null)).toBe(0);
    expect(normalizeMeteringDb(NaN)).toBe(0);
  });
});

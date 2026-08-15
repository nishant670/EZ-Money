import { getMonogram } from '@/lib/monogram';

describe('getMonogram', () => {
  it('takes the first and last initials of a full name', () => {
    expect(getMonogram('Nishant Munjal')).toBe('NM');
    expect(getMonogram('ada b lovelace')).toBe('AL');
  });

  it('takes one letter from a single-word name', () => {
    expect(getMonogram('Priya')).toBe('P');
  });

  it('does not turn a generated guest name into a seat number', () => {
    // `Guest_847550b7` splits on whitespace only, so the digits stay out of it.
    expect(getMonogram('Guest_847550b7')).toBe('G');
  });

  it('falls back when there is no name to read', () => {
    expect(getMonogram('')).toBe('F');
    expect(getMonogram(null)).toBe('F');
    expect(getMonogram(undefined)).toBe('F');
    expect(getMonogram('   ')).toBe('F');
    expect(getMonogram('•••')).toBe('F');
  });

  it('reads non-Latin names as their base letters', () => {
    // The vowel signs are combining marks and drop away; the two consonants
    // that remain are still the right two letters.
    expect(getMonogram('निशांत मुंजाल')).toBe('नम');
  });

  it('drops an emoji rather than monogramming it', () => {
    expect(getMonogram('\u{1F600} Bob')).toBe('B');
  });

  it('does not split an astral letter in half', () => {
    // U+20000 is a letter outside the basic plane; a code-unit slice would
    // return a lone surrogate and render as the replacement glyph.
    expect(getMonogram('\u{20000} Chen')).toBe('\u{20000}C');
  });
});

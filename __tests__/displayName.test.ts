import { isGeneratedGuestName, userDisplayName } from '@/lib/display-name';

describe('the name the user is greeted by', () => {
  it('does not read a generated guest id out loud', () => {
    // `Guest_" + uuid[:8]`, straight from internal/http/auth.go.
    expect(userDisplayName('Guest_59d8f84f')).toBe('Guest');
  });

  it('keeps a name the guest chose for themselves', () => {
    // Still `is_guest`, but this one is a name rather than a key — which is
    // why the pattern is what decides here, not the account's guest flag.
    expect(userDisplayName('Guest House')).toBe('Guest House');
    expect(userDisplayName('Nishant')).toBe('Nishant');
  });

  it('falls back when there is no name at all', () => {
    expect(userDisplayName(undefined)).toBe('Guest');
    expect(userDisplayName('   ')).toBe('Guest');
  });

  it('takes the caller’s word for the fallback', () => {
    // Splits name the payer in a sentence, where "Guest" would be a stranger.
    expect(userDisplayName('Guest_59d8f84f', 'You')).toBe('You');
  });

  it('only matches the shape the backend generates', () => {
    expect(isGeneratedGuestName('Guest_59d8f84f')).toBe(true);
    expect(isGeneratedGuestName('guest_59d8f84f')).toBe(true);
    // Not hex, and not the generated form — somebody's actual username.
    expect(isGeneratedGuestName('Guest_zzzz')).toBe(false);
    expect(isGeneratedGuestName('Guesthouse')).toBe(false);
  });
});

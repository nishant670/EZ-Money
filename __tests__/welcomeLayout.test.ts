import { HERO_BASE_SIZE, welcomeHeroSize } from '@/components/auth/welcome-layout';

/**
 * Welcome's three sign-in paths have to be reachable without scrolling, which
 * on a handset means the illustration cannot keep its design size. These pin
 * the arithmetic that decides how much of it survives.
 */
describe('welcome hero sizing', () => {
  it('draws the illustration at full size when the screen has room for it', () => {
    // A tall handset: 900dp of usable height is more than the screen needs.
    expect(welcomeHeroSize(900)).toBe(HERO_BASE_SIZE);
  });

  it('shrinks the illustration rather than pushing the sign-in options off screen', () => {
    // The handset this was reported on: ~760dp usable, where a fixed 260 hero
    // left Google and the email/mobile link below the fold.
    const size = welcomeHeroSize(700);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(HERO_BASE_SIZE);
  });

  it('never asks for more height than the screen has', () => {
    for (const available of [560, 620, 700, 760, 820, 900]) {
      // Whatever is left after the illustration is the chrome's, and the two
      // together are what the screen has to hold.
      expect(welcomeHeroSize(available)).toBeLessThanOrEqual(available);
    }
  });

  it('drops the illustration entirely once it would only be a smudge', () => {
    expect(welcomeHeroSize(560)).toBe(0);
    expect(welcomeHeroSize(0)).toBe(0);
  });
});

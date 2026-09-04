import { reversedIOSClientScheme } from '@/app/auth';

describe('iOS Google OAuth redirect scheme', () => {
  // Google does not use the bundle identifier on iOS the way Android uses the
  // package name — it uses the client id reversed. Getting this wrong fails
  // inside Google's consent screen, where the message is unhelpful.
  it('reverses a Google client id into its custom scheme', () => {
    expect(reversedIOSClientScheme('23289902813-abc123.apps.googleusercontent.com')).toBe(
      'com.googleusercontent.apps.23289902813-abc123'
    );
  });

  it('refuses anything that is not a Google client id', () => {
    expect(reversedIOSClientScheme('com.finnri.app')).toBeNull();
    expect(reversedIOSClientScheme('')).toBeNull();
    // An Android client id ends the same way, so shape alone cannot catch a
    // cross-platform mix-up — that is why the client is picked per platform
    // rather than by falling through a chain.
    expect(reversedIOSClientScheme('123.apps.googleusercontent.com.evil')).toBeNull();
  });
});

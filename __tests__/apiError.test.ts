import { getFriendlyErrorMessage } from '@/lib/api-error';

describe('api error messages', () => {
  it('replaces Android fetch connection details with readable copy', () => {
    expect(
      getFriendlyErrorMessage(
        new Error('fetch failed: java.net.ConnectException: Failed to connect to /192.168.0.101:8080'),
        'Unable to load activity.',
      ),
    ).toBe('Could not connect to Finnri. Check your internet connection and make sure the app is online.');
  });

  it('replaces URLs and IP addresses instead of showing raw endpoints', () => {
    expect(
      getFriendlyErrorMessage(
        'Failed to connect to http://192.168.0.101:8080/v1/entries',
        'Unable to load activity.',
      ),
    ).toBe('Could not connect to Finnri. Check your internet connection and make sure the app is online.');
  });

  it('keeps readable product messages intact', () => {
    expect(
      getFriendlyErrorMessage(
        new Error('Incorrect PIN. 2 attempts remaining.'),
        'Login failed.',
      ),
    ).toBe('Incorrect PIN. 2 attempts remaining.');
  });
});

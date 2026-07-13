import { useAuthStore } from '@/hooks/use-auth-store';
import { installApiSessionGuard } from '@/lib/api-session';
import { API_BASE_URL } from '@/lib/transactions';

const guardedResponse = (payload: unknown, status = 401) =>
  ({
    status,
    clone: () => ({
      json: jest.fn().mockResolvedValue(payload),
    }),
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  }) as unknown as Response;

const guestUser = {
  uuid: 'guest-uuid',
  is_guest: true,
  username: 'Guest',
};

describe('API session guard', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    jest.resetAllMocks();
  });

  it('does not clear auth for generic protected-route 401 responses', async () => {
    useAuthStore.getState().setAuth(guestUser, 'guest-token');
    global.fetch = jest.fn().mockResolvedValue(guardedResponse({ error: 'unauthorized' }));
    const onUnauthorized = jest.fn();
    const uninstall = installApiSessionGuard(onUnauthorized);

    await fetch(`${API_BASE_URL}/v1/tools/emi/calculate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer guest-token' },
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('guest-token');
    uninstall();
  });

  it('clears auth for explicit invalid session responses', async () => {
    useAuthStore.getState().setAuth(guestUser, 'guest-token');
    global.fetch = jest.fn().mockResolvedValue(guardedResponse({ error: 'invalid_or_expired_session' }));
    const onUnauthorized = jest.fn(() => useAuthStore.getState().clearAuth());
    const uninstall = installApiSessionGuard(onUnauthorized);

    await fetch(`${API_BASE_URL}/v1/tools/emi/calculate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer guest-token' },
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
    uninstall();
  });
});

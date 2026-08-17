import { fetchWithRetry } from '@/lib/api-retry';
import { API_BASE_URL } from '@/lib/transactions';

const ok = () => ({ status: 200 }) as unknown as Response;
const gateway = (status: number) => ({ status }) as unknown as Response;

describe('API retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * The retry sleeps between attempts, so every assertion has to let the fake
   * timers run while the promise is still in flight. Both outcomes are captured
   * on the same tick the promise is created — draining the timers first would
   * leave a rejection unhandled for as long as that takes, which Node reports
   * as a failure of its own.
   */
  const settle = async <T,>(pending: Promise<T>) => {
    const outcome = pending.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await jest.runAllTimersAsync();
    const result = await outcome;
    if (!result.ok) {
      throw result.error;
    }
    return result.value;
  };

  it('retries a read that never reached the server', async () => {
    const baseFetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(ok());

    const response = await settle(fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`));

    expect(response.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts and surfaces the original failure', async () => {
    const baseFetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    await expect(
      settle(fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`)),
    ).rejects.toThrow('Network request failed');
    expect(baseFetch).toHaveBeenCalledTimes(3);
  });

  it('retries the gateway statuses a cold container answers with', async () => {
    const baseFetch = jest
      .fn()
      .mockResolvedValueOnce(gateway(503))
      .mockResolvedValueOnce(ok());

    const response = await settle(fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/dashboard`));

    expect(response.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(2);
  });

  it('returns 4xx answers untouched — asking again gets the same answer', async () => {
    const baseFetch = jest.fn().mockResolvedValue(gateway(404));

    const response = await settle(fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`));

    expect(response.status).toBe(404);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('never repeats a write, which may have been handled before it failed', async () => {
    const baseFetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    await expect(
      settle(
        fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`, { method: 'POST', body: '{}' }),
      ),
    ).rejects.toThrow('Network request failed');
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('leaves requests to other origins alone, signal included', async () => {
    const baseFetch = jest.fn().mockResolvedValue(ok());

    await settle(fetchWithRetry(baseFetch, 'https://oauth2.googleapis.com/token'));

    expect(baseFetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', undefined);
  });

  it('stops retrying once the caller cancels', async () => {
    const controller = new AbortController();
    const baseFetch = jest.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Error('Aborted'));
    });

    await expect(
      settle(
        fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`, { signal: controller.signal }),
      ),
    ).rejects.toThrow('Aborted');
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('gives each attempt a deadline so a hung connection cannot stall the screen', async () => {
    const baseFetch = jest.fn().mockImplementation(
      (_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    await expect(
      settle(fetchWithRetry(baseFetch, `${API_BASE_URL}/v1/entries`)),
    ).rejects.toThrow('Aborted');
    expect(baseFetch).toHaveBeenCalledTimes(3);
  });
});

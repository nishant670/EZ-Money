import { deleteEntry } from '@/lib/entries';

/**
 * Deleting the same entry twice is reachable without doing anything unusual.
 *
 * `useUndoableDelete` commits whatever is pending as soon as a second delete is
 * requested, so an impatient double tap on a slow build sends the same id twice:
 * the first call removes the row, the second finds nothing. The row is gone —
 * which is what was asked for — and the failure path used to raise
 * "<name> is still in your ledger", the one claim that is definitely false in
 * that race, while the list behind the alert correctly showed it deleted.
 */
describe('deleteEntry', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('treats an already-deleted entry as success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'entry not found' }),
    }) as unknown as typeof fetch;

    await expect(deleteEntry('token', 42)).resolves.toBeUndefined();
  });

  it('still reports a real failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'db_error' }),
    }) as unknown as typeof fetch;

    await expect(deleteEntry('token', 42)).rejects.toBeDefined();
  });

  it('resolves on a normal delete', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(deleteEntry('token', 42)).resolves.toBeUndefined();
  });
});

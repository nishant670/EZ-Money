import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { DeleteGroupSheet } from '@/components/split/sheets/DeleteGroupSheet';
import { archiveSplitGroup } from '@/lib/splits';

jest.mock('@/lib/haptics', () => ({ haptics: { select: jest.fn() } }));

const props = {
  visible: true,
  groupName: 'Goa trip',
  expenseCount: 3,
  disposition: 'keep' as const,
  saving: false,
  onChangeDisposition: jest.fn(),
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * The question the sheet exists to ask, and the answer it must not assume.
 *
 * A split bill and a Finnri transaction are two records of one evening. The
 * balances go with the group either way — that part is not a preference — but
 * the transactions are the user's own record that money left the account, and
 * the app cannot pick for them.
 */
describe('deleting a split group', () => {
  it('names how many transactions are at stake', async () => {
    const screen = await render(<DeleteGroupSheet {...props} />);

    // "the expenses" leaves the reader to guess the size of what they are about
    // to destroy, which is the one thing this sheet is for.
    expect(screen.getByText(/3 transactions stay in your Finnri history/)).toBeTruthy();
    expect(screen.getByText(/3 transactions are removed from Finnri as well/)).toBeTruthy();
  });

  it('reads a single expense as one, not as "1 transactions"', async () => {
    const screen = await render(<DeleteGroupSheet {...props} expenseCount={1} />);

    expect(screen.getByText(/1 transaction stay/)).toBeTruthy();
  });

  it('offers no choice on a group with nothing on it', async () => {
    // Offering it would imply there is something to keep.
    const screen = await render(<DeleteGroupSheet {...props} expenseCount={0} />);

    expect(screen.getByText('There are no expenses on this group.')).toBeTruthy();
    expect(screen.queryByText('Keep the transactions')).toBeNull();
  });

  it('reports the choice rather than acting on it', async () => {
    const screen = await render(<DeleteGroupSheet {...props} />);

    await fireEvent.press(screen.getByText('Delete the transactions too'));

    expect(props.onChangeDisposition).toHaveBeenCalledWith('delete');
    // Choosing is not confirming: the destructive option is one tap away from
    // being selected and two from being carried out.
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be confirmed twice while the first is in flight', async () => {
    const screen = await render(<DeleteGroupSheet {...props} saving />);

    await fireEvent.press(screen.getByLabelText('Delete the group and keep its transactions'));

    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

/**
 * The wire format, which is where the safe default actually lives.
 *
 * An app build that predates this parameter sends nothing, and the server reads
 * an absent value as `keep` — so the default is spelled the same on both sides
 * rather than relying on one of them.
 */
describe('the delete request', () => {
  const okResponse = {
    ok: true,
    json: jest.fn().mockResolvedValue({ deleted_entries: 0 }),
  } as unknown as Response;

  it('keeps the transactions unless it is told otherwise', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse);

    await archiveSplitGroup('token', 7);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/split/groups/7?entries=keep'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('asks for the transactions to go only when that was chosen', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ...okResponse, json: jest.fn().mockResolvedValue({ deleted_entries: 3 }) });

    const result = await archiveSplitGroup('token', 7, 'delete');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('entries=delete'),
      expect.anything()
    );
    // Reported by the server rather than assumed by the app, so what the app
    // says happened is what happened.
    expect(result.deleted_entries).toBe(3);
  });
});

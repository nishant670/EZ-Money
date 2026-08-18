import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SplitInvitePrompt } from '@/components/split/SplitInvitePrompt';
import { resetDeferredSplitInvites } from '@/lib/split-invite-deferrals';
import { useAuthStore } from '@/hooks/use-auth-store';
import { acceptSplitGroupInvite, fetchPendingSplitGroupInvites } from '@/lib/splits';

jest.mock('@/lib/splits', () => ({
  fetchPendingSplitGroupInvites: jest.fn(),
  acceptSplitGroupInvite: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const fetchPending = fetchPendingSplitGroupInvites as jest.MockedFunction<
  typeof fetchPendingSplitGroupInvites
>;
const accept = acceptSplitGroupInvite as jest.MockedFunction<typeof acceptSplitGroupInvite>;

const invite = (id: number, groupName: string) => ({
  id,
  token: `token-${id}`,
  group_id: id,
  group_name: groupName,
  owner_name: 'Nishant',
  created_at: '2026-08-18T00:00:00Z',
});

describe('split invite prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDeferredSplitInvites();
    useAuthStore.setState({ token: 'auth-token', user: null });
  });

  it('brings the invite to the user with both answers', async () => {
    fetchPending.mockResolvedValue([invite(1, 'Couple')]);

    const screen = await render(<SplitInvitePrompt />);

    expect(await screen.findByText('Join Couple?')).toBeTruthy();
    expect(screen.getByText(/Nishant added you to Couple/)).toBeTruthy();
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Check later')).toBeTruthy();
  });

  it('accepting joins the group and lands the user on it', async () => {
    fetchPending.mockResolvedValue([invite(2, 'Goa')]);
    accept.mockResolvedValue({} as never);

    const screen = await render(<SplitInvitePrompt />);
    const acceptButton = await screen.findByText('Accept');
    await act(async () => {
      fireEvent.press(acceptButton);
    });

    expect(accept).toHaveBeenCalledWith('auth-token', 'token-2');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/split'));
    expect(screen.queryByText('Join Goa?')).toBeNull();
  });

  it('checking later closes it without accepting anything', async () => {
    fetchPending.mockResolvedValue([invite(3, 'Flat')]);

    const screen = await render(<SplitInvitePrompt />);
    const laterButton = await screen.findByText('Check later');
    await act(async () => {
      fireEvent.press(laterButton);
    });

    expect(accept).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Join Flat?')).toBeNull());
  });

  it('does not ask about the same invite twice in one session', async () => {
    fetchPending.mockResolvedValue([invite(4, 'Trip')]);


    const first = await render(<SplitInvitePrompt />);
    const laterButton = await first.findByText('Check later');
    await act(async () => {
      fireEvent.press(laterButton);
    });
    first.unmount();

    // A second open in the same session — the invite is still pending server
    // side, but the user has already said "later".
    const second = await render(<SplitInvitePrompt />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalledTimes(2));
    expect(second.queryByText('Join Trip?')).toBeNull();
    second.unmount();
  });

  it('asks about one group at a time', async () => {
    fetchPending.mockResolvedValue([invite(5, 'Couple'), invite(6, 'Office')]);

    const screen = await render(<SplitInvitePrompt />);

    expect(await screen.findByText('Join Couple?')).toBeTruthy();
    expect(screen.queryByText('Join Office?')).toBeNull();
  });

  it('stays out of the way when nobody is signed in', async () => {
    useAuthStore.setState({ token: null, user: null });

    const screen = await render(<SplitInvitePrompt />);

    expect(fetchPending).not.toHaveBeenCalled();
    expect(screen.toJSON()).toBeNull();
  });
});

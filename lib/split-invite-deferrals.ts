/**
 * Invites the user has said "check later" to, for as long as this launch lasts.
 *
 * They have to be asked again on the next open — the invite is still waiting and
 * the notification is still unread — but asking twice in one session, every time
 * the app comes back from the background, is nagging rather than reminding.
 * Module scope is exactly the lifetime we want: it dies with the process.
 *
 * This lives apart from the prompt that uses it so the auth store can clear it
 * on sign-out without the two importing each other.
 */
const deferred = new Set<number>();

export const deferSplitInvite = (inviteId: number) => {
  deferred.add(inviteId);
};

export const isSplitInviteDeferred = (inviteId: number) => deferred.has(inviteId);

/**
 * A deferral belongs to the person who made it. Signing out has to drop them, or
 * the next account on this device inherits an answer it never gave.
 */
export const resetDeferredSplitInvites = () => {
  deferred.clear();
};

/**
 * What to do with a deep link before the router sees it.
 *
 * Google's Android OAuth clients only accept a redirect whose scheme is the
 * package name, so signing in comes back into the app as
 * `com.finnri.app:/oauth2redirect?code=…`. That scheme is registered for the
 * app, so Android hands the URL to the one activity — and *both* listeners get
 * it: `expo-auth-session`, which is waiting for exactly this and completes the
 * sign-in, and expo-router's linking, which has no `/oauth2redirect` route and
 * therefore showed its "Unmatched Route" screen. The user saw that page flash
 * between picking their Google account and landing on Home.
 *
 * Returning a falsy value tells expo-router not to navigate at all, which is
 * the right answer: the redirect is a message to the auth session, not a
 * destination. `expo-auth-session` still receives it — this only filters what
 * the router does with it.
 *
 * Everything else, `ezmoney://` split-group invites included, passes through
 * untouched.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes('oauth2redirect')) {
      return null;
    }
  } catch {
    // A malformed URL is not worth crashing a cold start over; let the router
    // deal with it as it did before.
  }
  return path;
}

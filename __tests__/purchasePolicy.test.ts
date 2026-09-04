import fs from 'fs';
import path from 'path';

import { IN_APP_PURCHASE_ENABLED } from '@/lib/purchase-policy';

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('store build purchase policy', () => {
  // Google Play requires digital content consumed in-app to be sold through
  // Play Billing, and forbids steering users to an outside purchase flow.
  // Finnri sells through Razorpay on the web, so the app must sell nothing.
  it('keeps in-app purchase off', () => {
    expect(IN_APP_PURCHASE_ENABLED).toBe(false);
  });

  // These two are the only screens that ever showed a price or a buy button.
  // If either stops consulting the flag, the store build starts selling again
  // and nobody finds out until a review rejection.
  it.each([
    ['app/billing.tsx', 'the plan catalogue'],
    ['components/billing/UpgradeSheet.tsx', 'the paywall sheet'],
  ])('gates %s behind the flag', (file) => {
    expect(read(file)).toContain('IN_APP_PURCHASE_ENABLED');
  });

  it('never opens a payment provider from the app', () => {
    // No checkout SDK, and no hardcoded route to a hosted payment page. The
    // web dashboard is where money changes hands.
    for (const file of ['app/billing.tsx', 'components/billing/UpgradeSheet.tsx']) {
      const source = read(file);
      expect(source).not.toMatch(/razorpay/i);
      expect(source).not.toMatch(/checkout\.razorpay\.com/i);
    }
  });
});

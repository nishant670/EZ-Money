import fs from 'fs';
import path from 'path';

import { CHECKOUT_LINK_ENABLED, IN_APP_PURCHASE_ENABLED } from '@/lib/purchase-policy';

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('store build purchase policy', () => {
  // No purchase happens inside the app. Google Play requires digital content
  // consumed in-app to be sold through Play Billing; Finnri sells on the web,
  // so the app opens a browser and reflects the entitlement the webhook grants.
  it('keeps in-app purchase off', () => {
    expect(IN_APP_PURCHASE_ENABLED).toBe(false);
  });

  // Linking out is steering, which Play restricts in most markets. India is
  // the exception after the 2022 CCI order, and India is the only market
  // Finnri ships to. Distributing anywhere else turns this into a region check.
  it('reaches payment by opening the hosted page', () => {
    expect(CHECKOUT_LINK_ENABLED).toBe(true);
  });

  // These two are the only screens that ever show a price or a way to pay. If
  // either stops consulting the flags, the store build's behaviour changes and
  // nobody finds out until a review rejection.
  it.each([
    ['app/billing.tsx', 'the plan catalogue'],
    ['components/billing/UpgradeSheet.tsx', 'the paywall sheet'],
  ])('gates %s behind the policy flags', (file) => {
    expect(read(file)).toContain('IN_APP_PURCHASE_ENABLED');
  });

  // The app must never embed a payment SDK or a hardcoded provider URL. It
  // opens the URL the server hands it and nothing else, so the web origin
  // lives in one place and a staging build cannot reach production's checkout.
  it('never names a payment provider or builds its own checkout URL', () => {
    for (const file of ['app/billing.tsx', 'components/billing/UpgradeSheet.tsx', 'lib/billing.ts']) {
      const source = read(file);
      expect(source).not.toMatch(/razorpay\.com/i);
      expect(source).not.toMatch(/checkout\.razorpay/i);
    }
    // The one mention allowed is telling the user who takes the payment.
    expect(read('app/billing.tsx')).toContain('handled by Razorpay');
  });

  it('takes the checkout URL from the server rather than assembling one', () => {
    const source = read('app/billing.tsx');
    expect(source).toContain('order.checkout_url');
    // No string concatenation onto an API base to reach a pay page.
    expect(source).not.toMatch(/\/pay\?order=/);
  });
});

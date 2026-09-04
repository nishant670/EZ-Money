/**
 * Whether the app itself may sell anything.
 *
 * **False, deliberately.** Finnri collects payment through Razorpay web
 * checkout on finnri.com, which is why the fee case in
 * `docs/PLANS_AND_CREDITS_PRICING_PLAN.md` was made: UPI carries no MDR where
 * Play Billing takes 15%.
 *
 * Google Play requires that digital content consumed inside an app be sold
 * through Play Billing, and its anti-steering rules also forbid pointing users
 * at an outside purchase flow. So the store build does neither: it shows the
 * plan and credits the account already has — which is information, not a sale —
 * and offers no purchase button, no price list, and no link out to the web.
 *
 * Flip this to true only in the change that integrates Play Billing (and
 * StoreKit for iOS). It must not be flipped to re-expose the web checkout.
 */
export const IN_APP_PURCHASE_ENABLED = false;

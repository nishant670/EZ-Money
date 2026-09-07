/**
 * Whether the app itself may sell anything.
 *
 * **False, deliberately.** Finnri collects payment through Razorpay web
 * checkout on Finnri's configured web origin, which is why the fee case in
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

/**
 * Whether the app may open the hosted checkout page in a browser tab.
 *
 * **True, and separate from `IN_APP_PURCHASE_ENABLED` on purpose.** No purchase
 * happens inside the app: the tap opens a browser, the payment is taken on a
 * web page by Razorpay, and the app only ever reflects the entitlement the
 * webhook grants. That is a different thing from an in-app purchase flow,
 * which stays off.
 *
 * Linking out like this is steering, which Google Play restricts in most
 * markets. India is the exception: following the 2022 CCI order Google no
 * longer enforces anti-steering against apps distributed in India, which is
 * the whole market Finnri ships to.
 *
 * **If Finnri is ever distributed outside India, this must become a
 * region check rather than a constant.** Confirm the current Play terms in
 * the Console before each submission; this area has changed repeatedly.
 */
export const CHECKOUT_LINK_ENABLED = true;

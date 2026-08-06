# Accounts Deferred Backlog

Last updated: 2026-08-06

This backlog captures accounts work intentionally deferred after the manual account setup UX pass. The current implementation improves the manual UI flow only; the items below require transaction-capture changes, backend/API changes, or notification/reminder work.

## 1. Smarter Account Defaults From Transactions

### Goal
When a transaction mentions a payment source that does not exist yet, Finnri should suggest creating the matching account instead of forcing the user to add it manually later.

### Example
- User enters: `Spent 850 on Swiggy using HDFC card`
- Finnri parses payment source as `HDFC card`
- User has no HDFC credit/debit card account
- Confirmation flow shows: `Create HDFC card account?`

### Suggested Scope
- Add account-suggestion logic in transaction confirmation flow.
- Match parsed payment mode/provider text against existing accounts.
- Suggest account type from card, UPI, wallet, and bank signals.
- Pre-fill account creation with provider, type, color, and name.
- Let user create inline or skip.

### Product Rules
- Never auto-create accounts without confirmation.
- Keep the transaction confirmation flow primary; account suggestion should be secondary.
- Avoid blocking save if the user dismisses the suggestion.
- Do not suggest duplicates if a matching provider/identifier already exists.

### Acceptance Criteria
- A parsed transaction can surface a create-account suggestion.
- Suggested account opens the existing account setup flow with prefilled values.
- If user creates the account, the transaction can use that account.
- If user skips, transaction save still works with the selected/default account.

## 2. Structured Account Providers And Logos

### Goal
Move beyond plain provider strings so accounts can show consistent labels, icons/logos, and matching behavior.

### Current State
- `provider` is a free-text string.
- UI has local provider presets only.
- No backend provider ID or logo metadata exists.

### Suggested Backend Model
- Add provider catalog support:
  - `provider_id`
  - `display_name`
  - `type_support`: bank, credit_card, debit_card, wallet, upi
  - `logo_url` or local asset key
  - aliases for matching, e.g. `HDFC`, `HDFC Bank`, `HDFC card`

### Suggested Frontend Scope
- Use provider catalog for account setup chips/search.
- Show provider logo or consistent icon on account cards/details.
- Use aliases for transaction-to-account matching.

### Acceptance Criteria
- Account creation can save a structured provider reference.
- Existing free-text providers continue to display safely.
- Account cards/details can render provider-specific visuals when available.
- Provider matching does not depend only on exact string equality.

## 3. Richer Account Metadata

### Goal
Stop overloading `identifier` for unrelated account details.

### Current State
The generic `identifier` field stores card last 4 digits, bank last 4 digits, UPI handle/nickname, wallet nickname, and other reference text.

### Proposed Fields
- `last4` for bank/card account identification.
- `upi_handle` for UPI accounts.
- `wallet_identifier` or `wallet_nickname` for wallet accounts.
- `account_nickname` if different from display name.
- Keep `identifier` temporarily for backwards compatibility/migration.

### Acceptance Criteria
- Account APIs support structured metadata.
- UI maps type-specific inputs to type-specific fields.
- Existing accounts do not lose display identifiers.
- Transaction matching can use the correct field per account type.

## 4. Credit Card Reminder Settings

### Goal
Turn collected credit-card due dates into useful reminders.

### Current State
- Account setup collects `due_day`.
- UI shows due labels.
- No reminder settings or notification scheduling are connected.

### Suggested Scope
- Add reminder settings per credit card:
  - enabled/disabled
  - remind N days before due date
  - optional statement day
  - optional minimum due/payment note later
- Use existing notification infrastructure if available.
- Show reminder state on account detail.

### Product Rules
- Do not claim payments are made through Finnri.
- Use language like `Reminder`, not `Pay now`, unless payment integration exists.
- Reminders should be editable and dismissible.

### Acceptance Criteria
- User can enable a credit-card due reminder.
- Reminder date is calculated from due day and lead time.
- Account detail shows next reminder state.
- No payment action is shown unless actual payment integration exists.

## Suggested Implementation Order

1. Transaction-based account suggestions using current fields.
2. Structured provider catalog and aliases.
3. Account metadata split/migration.
4. Credit-card reminder settings and notification scheduling.

## Notes

- The manual account setup UX is already improved and should be reused.
- Prefer extending current account setup routes with prefilled params rather than creating a separate account creation surface.
- Keep all new account creation confirm-first.

# Keyboard regression checklist

After every React Native or Expo major upgrade, focus the last editable field
on each screen below on an Android edge-to-edge device (the OnePlus test device
when available) and on iOS. The field and its label must remain visible above
the keyboard, and the screen must still scroll to its final action.

- Account setup (`app/accounts/manage.tsx`), especially Last 4 digits on step 2
- Security (`app/security.tsx`)
- Feedback (`app/feedback.tsx`)
- Category detail (`app/category-detail.tsx`)
- Merchant history (`app/merchant-history.tsx`)
- Statement review (`app/statements/review.tsx`)
- Transactions (`app/transactions/index.tsx`)
- Home capture (`app/(tabs)/index.tsx`)
- Split group detail and member search
- Advanced transaction filters
- Transaction split fields

Bottom sheets use the same `useKeyboardInset` mechanism. Re-check at least one
account picker or statement form sheet as part of the same pass.

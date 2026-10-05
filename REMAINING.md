# Payro — Remaining Work to Implement

Status: the current project is a **high-fidelity clickable UI prototype** (15 screens,
full design system, navigation wired). All data shown is static mock data. Below is
what remains to turn it into a production product.

## 1. Backend foundation
- Set up a Postgres database (Supabase, AWS RDS, or self-hosted) with auth and storage.
- Tables: `profiles`, `groups`, `group_members`, `expenses`, `expense_splits`,
  `transactions`, `wallets`, `notifications`, `receipts`, `user_roles`.
- Row Level Security on every table (member-scoped reads/writes), plus explicit
  GRANTs for `authenticated` / `service_role`.
- Roles stored in a separate `user_roles` table with a `has_role()` security-definer
  function — never on `profiles`.

## 2. Authentication (currently mock)
- Real phone-number auth: OTP send/verify, resend cooldown, rate limiting.
- Session persistence + protected route gate (redirect unauthenticated to `/auth`).
- Profile creation on first sign-in (name, avatar upload, country, currency).
- Optional biometric unlock / app PIN.

## 3. Mobile Money integrations (no live payment rails yet)
- M-Pesa (Daraja STK Push), Airtel Money, MTN MoMo collections + disbursements.
- Payment intent records, idempotency keys, webhook endpoints under
  `/api/public/*` with signature verification.
- Async status polling and reconciliation of pending → success/failed states.
- Fees, FX, currency handling per market; minimum/maximum limits.
- Sandbox vs production credential switching.

## 4. Wallet & ledger
- Double-entry ledger so balances are derived, never edited directly.
- Top-up, withdraw, internal transfer flows with real balance checks.
- Transaction statements + export (CSV/PDF).

## 5. Groups & expense splitting logic
- Create/join group via invite link or QR, member roles (admin/member).
- Split modes: equal, exact amounts, percentage, shares — with validation that
  splits sum to the total.
- Debt simplification algorithm ("who owes whom", minimal transfer set).
- Settle-up flow that creates a real payment and closes balances.
- Recurring / scheduled expenses.

## 6. AI receipt scanning (UI only today)
- Camera capture + upload to storage.
- OCR / vision model via third-party service (Claude AI, Google Vision, AWS Textract) to extract merchant, date, total,
  line items, tax.
- Review-and-correct screen before commit; confidence indicators.
- Auto-categorisation of expenses and merchant memory.

## 7. Requests, notifications & realtime
- Money requests: create, accept, decline, remind, expire.
- Push notifications (FCM/APNs) + in-app notification persistence and read state.
- Realtime subscriptions so group balances and activity update live.

## 8. Analytics
- Replace mock charts with real aggregates (spend by category, month over month,
  group contribution, cash-flow).
- Server-side aggregation with date-range filters and caching.

## 9. QR
- Real QR generation encoding a signed payment/join payload.
- Camera-based QR scanning with payload validation and expiry.

## 10. Security & compliance
- KYC tiers and document upload for higher limits.
- AML screening hooks, transaction velocity limits, fraud rules.
- Audit log of sensitive actions; PII minimisation and encryption at rest.
- Secrets stored as backend secrets, never in client code.
- Data retention and consent/privacy policy screens.

## 11. Product polish
- Loading skeletons, empty states, error states and retry for every data screen.
- Offline handling and optimistic updates.
- Form validation with inline errors (Zod).
- Accessibility pass: focus order, contrast, touch targets, screen-reader labels.
- Localisation (EN/FR/SW), currency and date formatting per locale.
- Dark mode tokens verification across all screens.

## 12. Engineering & release
- Unit tests for split/settlement math; integration tests for payment webhooks.
- E2E tests for auth → create group → add expense → settle.
- Error monitoring and analytics events.
- CI, staging environment, seeded demo data.
- Native shell (Capacitor/Expo wrapper) if app-store distribution is required,
  plus app icons, splash assets and store listings.

## Suggested build order
1. Cloud + schema + RLS
2. Real auth and profiles
3. Groups + expenses + split math
4. Wallet ledger
5. One Mobile Money provider end to end (M-Pesa), then the others
6. AI receipt scanning
7. Notifications + realtime
8. Analytics from real data
9. KYC/compliance, tests, release hardening

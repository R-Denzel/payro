 # Payro — From Prototype to Production

Payro is currently a **high-fidelity, clickable front-end prototype**: every screen, flow and
calculation is real, but data lives in the browser (localStorage) and payments are simulated.
This guide is the full path to a working, launchable app.

---

## 1. What you have today

**Stack:** TanStack Start (React 19 + Vite 7), TanStack Router (file-based routes), Tailwind CSS v4, shadcn/ui, Lucide icons.

```
src/
  styles.css                 design tokens (emerald/navy, radii, glass + gradient utilities)
  routes/                    one file per screen (file-based routing)
    index.tsx                splash
    onboarding.tsx           3-step value story
    auth.tsx / auth.otp.tsx  phone sign-in + 6-digit OTP
    home.tsx                 "Split a Bill" hero, pending requests, owed/owe, settlement
    scan.tsx                 AI receipt scanner + item assignment + split modes
    claim.$id.tsx            public link: pick your name, tick items, pay creator
    expense.new.tsx          manual split
    expense.$id.tsx          per-member paid / pending / reminded
    groups.tsx / groups.$id.tsx
    request.tsx              request money
    pay.tsx                  mobile money (M-Pesa style) + settled celebration
    wallet.tsx activity.tsx notifications.tsx analytics.tsx profile.tsx qr.tsx
  components/payro/Frame.tsx MobileFrame, BottomNav + action sheet, SettlementBar
  lib/split-store.ts         split maths: by item / equal / custom weights, service + VAT pro-rata
```

**Run locally**

```bash
bun install      # or: npm install
bun run dev      # http://localhost:8080
bun run build
```

Node 20+ recommended. The app targets an edge runtime (Cloudflare Workers) on build.

---

## 2. Build order (recommended)

### Phase 1 — Backend foundation
Enable a backend (Supabase or self-hosted Postgres with auth and storage via Supabase, AWS RDS, or similar).

Minimum schema:

| table | key columns |
|---|---|
| `profiles` | `id` (= auth user), `full_name`, `phone`, `avatar_url` |
| `groups` | `id`, `name`, `created_by`, `created_at` |
| `group_members` | `group_id`, `user_id`, `role` |
| `expenses` | `id`, `group_id`, `creator_id`, `merchant`, `subtotal`, `service`, `tax`, `total`, `split_mode` (`items`/`equal`/`custom`), `status`, `receipt_url`, `created_at` |
| `expense_items` | `id`, `expense_id`, `name`, `price`, `qty` |
| `item_claims` | `item_id`, `participant_id` (composite unique) |
| `expense_participants` | `expense_id`, `user_id` *or* `guest_name`/`guest_phone`, `share_weight`, `amount_due`, `amount_paid`, `status` |
| `payments` | `id`, `expense_id`, `payer_id`, `amount`, `provider`, `provider_ref`, `status`, `created_at` |
| `share_links` | `token`, `expense_id`, `expires_at` |

Rules to enforce **server-side** (never trust the client):
- Row-level security: a user reads an expense only if they created it or participate in it.
- Public claim links resolve by opaque `token` only — never by expense id.
- Roles (admin/member) live in their own table, never on `profiles`.
- Amounts are recomputed on the server from items/weights before any payment is initiated.

Store money as **integer minor units** (cents), as `split-store.ts` already does.

### Phase 2 — Auth
Replace the mocked OTP with real phone auth (SMS OTP). Add rate limiting (max ~5 sends/hour/number),
a 5-minute code expiry, and post-verify profile creation. Keep `/auth` and `/auth/otp` UI as-is.

### Phase 3 — Move split logic server-side
`src/lib/split-store.ts` is the spec. Port `personTotal`, `equalTotal`, `customTotal` into a server
module and expose server functions:
`createExpense`, `updateItemClaims`, `setSplitMode`, `setShares`, `getExpenseByToken`, `settleShare`.
Keep the client functions for optimistic UI only.

### Phase 4 — Receipt OCR (the "AI" scanner)
1. Upload the photo to storage from `scan.tsx`.
2. Server function sends the image to a vision model and asks for strict JSON:
   `{ merchant, currency, items:[{name, qty, unit_price}], subtotal, service_charge, tax, total }`.
3. Validate with Zod; if `sum(items) + service + tax != total`, flag the expense for manual review
   instead of silently trusting it.
4. Persist items, then show the existing review screen.
Keep the manual-edit path — OCR on faded thermal receipts will fail sometimes.

### Phase 5 — Real money movement
Wire the payment step in `pay.tsx` to actual rails:
- **M-Pesa (Kenya):** Daraja STK Push. Server initiates, returns a `CheckoutRequestID`, and a
  webhook (public, signature/IP-verified) confirms. Never mark paid on the client callback.
- **Airtel Money / MTN MoMo:** collections API, same request → webhook pattern.
- **Cards/regional:** Paystack or Flutterwave as fallback.
Requirements: idempotency keys per payment attempt, a `payments` audit row for every state change,
retry/timeout handling, and reconciliation of provider refs to expense shares.

### Phase 6 — Notifications
Payment requests and reminders need to leave the app: SMS or WhatsApp for requests
(`Amara requests KES 640 for Java House — <link>`), plus push (web push / FCM) and email digests.
Add a `notifications` table so `/notifications` reflects real events.

### Phase 7 — Hardening before launch
- Analytics screen: replace mock series with aggregate queries.
- Currency + locale formatting per country (KES, UGX, TZS, NGN, GHS).
- Offline/poor-network: queue actions, show clear retry states.
- Accessibility: focus states, 44px touch targets, contrast on the emerald-on-navy surfaces.
- Legal/compliance: KYC thresholds, data-protection registration (Kenya DPA 2019), a settlement
  dispute path, and clear terms that Payro settles between users rather than holding funds.
- Observability: error reporting, payment failure alerts, webhook dead-letter queue.

---

## 3. Known gaps in the prototype

- Data resets — `localStorage` only, no accounts, no multi-device sync.
- OTP accepts any 6 digits.
- OCR results are scripted, not from a real receipt.
- Payments always succeed after a delay; no failure or timeout paths.
- Reminders, notifications and analytics are static.
- Group membership, invites and permissions are not enforced.
- No currency handling beyond KES display.

## 4. Suggested milestones

| Milestone | Scope |
|---|---|
| M1 | Backend + auth + real groups/expenses (manual split only) |
| M2 | Share links + item claiming + server-side split maths |
| M3 | Receipt OCR |
| M4 | M-Pesa collections + webhook reconciliation |
| M5 | SMS/WhatsApp requests + reminders + push |
| M6 | Analytics, multi-currency, compliance, launch |

Keep the design system untouched while you do this: everything in `styles.css` and
`components/payro/Frame.tsx` is production-ready.

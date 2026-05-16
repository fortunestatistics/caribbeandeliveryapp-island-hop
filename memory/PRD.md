# IslandHop — Product Requirements Document

## Original Problem Statement
Build **IslandHop**, a comprehensive Caribbean delivery app with multi-service capabilities (Food, Pharmacy, Groceries, General Courier, Taxi, Car Rental). Key requirements:
- Real-time order tracking with live GPS
- In-app messaging and AI customer support
- Multiple payment methods, real Stripe payments, vendor payouts, refunds
- DoorDash-like UI with vibrant Caribbean theme
- Mobile-responsive with hamburger menu
- Driver/Restaurant/Business onboarding (5-6 step wizards)
- Car Rental & KPI dashboards

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI. `App.js` routes all pages.
- **Backend**: FastAPI single-module `server.py` (~4500 lines — needs router split).
- **DB**: MongoDB (Motor async driver). Geospatial 2dsphere index for driver locations; TTL index on history.
- **Real-time**: WebSockets (custom `ConnectionManager`).
- **Auth**: JWT Bearer (primary) + session_token cookie (legacy). `get_current_user_from_request` accepts both.
- **Payments**: Stripe Checkout (hosted) + Stripe Connect Express + Stripe Refunds + Stripe Transfers (driver/vendor payouts). APScheduler runs nightly payout cron at 02:00 UTC.
- **Maps**: Google Maps JS API.
- **Search**: `/api/search` aggregates vendors/products.
- **Backend tests**: 48 pytest cases, 100% passing (`/app/backend/tests/test_islandhop_backend.py` + `test_payments.py`).

## What's Implemented (CHANGELOG)
### Feb 2026 — Brand overhaul: Matte Black + Metallic Gold + Neon Cyan (this session)
- Dark-first theme using user's brand palette: matte black backgrounds (#0C0C0C / #141414 / #1E1E1E), metallic gold gradient CTAs (#E8C872 → #D4AF37 → #AA7C11), neon cyan functional accents (#00F2FE), white text.
- Tailwind config: added `matte`/`gold`/`neon` color tokens, `bg-gold-gradient` utility, `shadow-gold-glow/-lg` + `shadow-cyan-pulse`, `animate-pulse-cyan` keyframe, `font-heading` (Outfit) + `font-sans` (Manrope) from Google Fonts.
- Forced `dark` class on `<html>` so the whole app boots in matte black; light-mode HSL variables preserved for future toggle.
- Shadcn `Button` default variant → gold gradient with gold-glow on hover.
- `index.css`: gold selection color, gold scrollbar thumb, `.text-gold-gradient` utility for the hero headline.
- Bulk recolor across 28 components (App.js + every onboarding wizard + every dashboard + Wallet/Checkout/etc.): teal/orange/turquoise/yellow → gold, blue → neon cyan, white surfaces → matte-800/card, gray text → muted-foreground.
- Hero section: matte black with radial gold ambient glow + cyan corner accent; gold-gradient headline; gold-glow Get Started CTA.
- Header: matte-900/90 + backdrop-blur-xl + gold hairline border.
- 116/116 backend tests still passing — UI overhaul required no backend changes.

### Feb 2026 — Wallet + CariPay (previous session)
- **IslandHop in-app multi-currency wallet** (USD, JMD, TTD, BBD, GHS, NGN, ZAR).
- Endpoints: `GET /api/wallet`, `GET /api/wallet/transactions`, `POST /api/wallet/link` & `DELETE`, `POST /api/wallet/deposit` (from CariPay), `POST /api/wallet/withdraw` (to CariPay), `POST /api/wallet/send` (P2P between IslandHop users), `POST /api/wallet/pay-order` (wallet → order). All atomic via Mongo `$inc` with compare-and-set debits.
- **CariPay client** (`/app/backend/caripay_client.py`) with `MOCK_CARIPAY=true` toggle — short-circuits to simulated success today; flip to false + fill `_real_deposit/_real_withdrawal` once CariPay's API is live.
- **Webhook receiver** `POST /api/webhook/caripay` with HMAC-SHA256 signature verification (skipped in MOCK), idempotency by `external_transfer_id`, currency allowlist.
- Frontend page `/wallet` — gradient USD balance card, JMD card, CariPay link/unlink, deposit/withdraw/send modals, transaction history.
- "Pay with wallet" button added to `CheckoutPage` (alongside Stripe Pay).
- Race-fix on `/wallet/pay-order`: order lock acquired BEFORE wallet debit.
- Email lookup in P2P send made case-insensitive.
- 36 new pytest cases — backend total **84/84 passing**.

### Feb 2026 — Payment system overhaul (previous session)
**Phase A — Customer can actually pay**
- `POST /api/payments/checkout/session` — server-controlled amounts (reads `total` from DB; never trusts frontend). Returns Stripe-hosted Checkout URL + session_id.
- `GET /api/payments/checkout/status/{session_id}` — idempotent polling, marks order `payment_status='paid'` exactly once.
- `POST /api/webhook/stripe` (+ legacy alias `/api/payments/webhook/stripe`) — signature-verified, returns 400 on bad signatures (so Stripe retries).
- Frontend `CheckoutPage`, `PaymentSuccess` (polling), `PaymentCancel` at `/checkout/:orderId`, `/payment/success`, `/payment/cancel`.

**Phase B — Vendors get paid for real**
- `POST /api/vendor/connect/onboarding` — creates Stripe Connect Express account, returns hosted onboarding URL (bank info stays on Stripe).
- `GET /api/vendor/connect/status` — `charges_enabled` / `payouts_enabled` / `onboarding_complete`.
- Frontend `VendorStripeConnect` page at `/vendor/connect-stripe` + return/refresh callbacks.
- APScheduler nightly job at 02:00 UTC → `process_daily_vendor_payouts()` (batches by vendor, real `stripe.Transfer.create`).

**Phase C — Refunds + driver payouts**
- `POST /api/orders/{id}/refund` — full or partial via `stripe.Refund.create(payment_intent=…)`. Sets order status `refunded`/`partially_refunded`, reverses vendor payout, writes audit row to `db.refunds`.
- `POST /api/drivers/{id}/payout` — `stripe.Transfer.create` to driver's Connect account, debits wallet, records withdrawal.

**Backend stability** (cleanup during this pass)
- Removed duplicate `Order` and `OrderItem` Pydantic class definitions (latent shadow bugs).
- Wrapped `get_checkout_status` with proper Stripe error → 404/502 mapping.
- 27 pre-existing tests still green + 21 new payment tests = 48/48.

### Earlier
- Phase 1: Driver/Restaurant/Business onboarding, partner selection, landing page.
- Phase 2 (most): Global search, commissions, vendor/driver wallets, Google Maps tracking, Vendor/Driver/Admin dashboards, Menu Management, Promo Codes, Address Management, Customer Support tickets, Ratings & Reviews, Order Scheduling (one-time + daily/weekly/monthly recurring), Push-notifications infra.

## Roadmap

### P0 (next)
- Frontend E2E test for the new checkout flow + Stripe Connect page (currently only backend was tested).
- Wire a "Pay now" button onto the order success page (right after order creation) — the page currently doesn't redirect to `/checkout/:orderId`.
- Add "Refund this order" button on `/admin` order detail (endpoint is live; UI button only).
- Add "Connect bank account" CTA on Vendor Dashboard and Driver Dashboard.

### P1
- Persist `banking_info` field on Restaurant/Driver/Business models for record-keeping (Stripe holds the real data but we should store last4 + onboarding date locally).
- Configure real `STRIPE_WEBHOOK_SECRET` and document the webhook URL for Stripe Dashboard config.
- Authenticate `POST /api/promo-codes/{code}/apply` via JWT (currently takes `user_id` as query param).
- Migrate `POST /api/drivers/{id}/location` from query-params to JSON body.
- Audit all PUT handlers for client-controlled `user_id`/`owner_id` (already fixed addresses; check others).

### P2
- Detailed payment analytics & forecasting dashboard.
- Modularise `server.py` into routers (`auth`, `orders`, `scheduled_orders`, `payments`, `vendors`, `drivers`, `analytics`).
- Break down `App.js` into per-route page components.
- Background cron to materialise next `RecurringOrder` occurrence into a real order.
- Multi-currency support (JMD, USD, KYD, BBD…).

## Key DB Schema (additions this session)
- `payment_transactions`: id, session_id, payment_id, user_id, email, amount, currency, payment_status, metadata{order_id}, timestamps
- `refunds`: id, order_id, amount, stripe_refund_id, reason, issued_by, created_at
- `vendor_stripe_accounts`: id, vendor_id, vendor_type, stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete

## Integrations
- Stripe — Checkout, Connect Express, Refunds, Transfers (real API calls via `stripe` SDK + `emergentintegrations.payments.stripe.checkout`).
- Google Maps API.
- WebSockets (in-house).
- APScheduler (nightly payout cron at 02:00 UTC).

## Test Credentials
See `/app/memory/test_credentials.md`. No seeded users; tests register fresh users per run.

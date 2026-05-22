# IslandHop — Product Requirements Document

## Original Problem Statement
Build **IslandHop**, a comprehensive Caribbean multi-service logistics platform (Food, Pharmacy, Groceries, Courier, Taxi, Car Rental). Requirements:
- Real-time order tracking with live GPS
- In-app messaging & AI customer support
- Multiple payment methods (Stripe real, CariPay wallet, in-app wallet)
- Doordash-like UI with luxury **Matte Black + Metallic Gold + Neon Cyan** theme
- Driver/Restaurant/Business onboarding (5-6 step wizards)
- Car Rental & KPI dashboards
- Customer/Driver/Merchant/Admin roles
- Multi-currency (TTD default, USD, JMD), live converter
- Ratings, reviews, driver incentives
- **MVP rollout** P1 features added in Feb 2026: OTP signup, Referrals, Proof of Delivery, Service Zones, WhatsApp support, Admin approvals.

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI. `App.js` routes all pages.
- **Backend**: FastAPI single-module `server.py` (~6.2k lines — recommend splitting into `/routers/`).
- **DB**: MongoDB (Motor async). 2dsphere geo index, TTL on history.
- **Real-time**: WebSockets (custom `ConnectionManager`).
- **Auth**: JWT Bearer (primary) + legacy session cookie. `get_current_user_from_request` accepts both.
- **Payments**: Stripe Checkout + Connect Express + Refunds + Transfers. APScheduler nightly cron 02:00 UTC.
- **Wallet**: Multi-currency, CariPay link (mocked), P2P send, request/approve, deposit/withdraw, pay-order.
- **Maps**: Google Maps JS API.
- **Twilio**: Mocked client `twilio_client.py` (`MOCK_TWILIO=true`) for SMS OTP + WhatsApp.

## What's Implemented (CHANGELOG)

### Feb 2026 — MVP P1 Rollout (this session)
- **OTP signup verification** (mocked Twilio SMS)
  - `POST /api/otp/send` — 6-digit code, throttled 5/hour. Returns `dev_code` in MOCK mode.
  - `POST /api/otp/verify` — verify code, marks `users.phone_verified=true`.
  - `/api/auth/register` accepts `otp_code` + `referral_code`. `User.phone_verified` field added.
  - Frontend: `OTPVerification.js` widget; `/signup` flow gates on phone OTP.
- **Referral engine**
  - `GET /api/referrals/my-code` — get/create unique 8-char code per user.
  - `POST /api/referrals/apply` — link referee→referrer (rejects self / invalid).
  - `GET /api/referrals/my-referrals` — stats + history.
  - Reward TTD $10 (configurable via `REFERRAL_REWARD_AMOUNT/CURRENCY`) credited to BOTH wallets on referee's first paid order (hooked into Stripe checkout status + webhook).
  - Frontend: `/referrals` page with copy/share, stats cards, history.
- **Proof of Delivery**
  - `POST /api/orders/{id}/proof` — driver uploads base64 photo + notes + recipient + lat/lng. Sets order `status=delivered`.
  - `GET /api/orders/{id}/proof` — customer/driver/admin authorized.
  - Frontend: `DeliveryProofUpload.js` component (camera capture, geolocation).
- **Service Zone Management**
  - `POST/GET/PUT/DELETE /api/service-zones` — admin CRUD with polygon `[[lat,lng]…]`.
  - `POST /api/service-zones/check` — ray-casting point-in-polygon with optional service filter.
  - Frontend: Admin Panel "Zones" tab with creation form + list/delete.
- **WhatsApp Support Bridge** (mocked Twilio)
  - `POST /api/whatsapp/send` — admin/agent outbound.
  - `POST /api/webhook/whatsapp` — Twilio inbound webhook (form-encoded or JSON).
  - `GET /api/whatsapp/messages` and `GET /api/whatsapp/conversations` — admin/agent.
  - Frontend: Admin Panel "WhatsApp" tab with conversation list + reply UI.
- **Driver/Merchant Approval UI**
  - `GET /api/admin/pending-approvals` — aggregates pending drivers + restaurants + car-rentals + business applications.
  - `POST /api/admin/{drivers|restaurants|car-rentals|businesses}/{id}/{approve|reject}` with notes.
  - Frontend: Admin Panel "Approvals" tab.
- **Tests**: 22 new pytest cases (`test_p1_features.py`) — all pass. Backend total **158/158**.
- **Frontend**: New components/pages: `OTPVerification.js`, `ReferralPage.js`, `DeliveryProofUpload.js`; AdminPanel new tabs (approvals/zones/whatsapp); AuthPage signup updated with referral input + OTP step.

### Feb 2026 — Brand overhaul + Wallet/CariPay + Payments + Reviews/Incentives (prior session)
- Matte Black / Metallic Gold / Neon Cyan theme.
- Multi-currency Wallet (USD/JMD/TTD/BBD/GHS/NGN/ZAR) + CariPay link + P2P + webhook idempotency.
- Stripe Checkout, Connect Express, Refunds, Transfers; APScheduler nightly payouts.
- Currency converter (TTD/USD/JMD), Apple/Google Pay UI.
- Ratings/Reviews + Driver Incentives (5★ bonus, weekly top driver).
- 116/116 backend tests at end of that session.

### Earlier
- Phase 1: Driver/Restaurant/Business onboarding, partner selection, landing.
- Phase 2: Global search, commissions, vendor/driver wallets, Google Maps tracking, all dashboards, Menu Mgmt, Promo Codes, Address Management, Customer Support tickets, Order Scheduling (one-time + recurring), Push-notifications infra.

## Roadmap

### P0 — Done ✅
- (All previous P0s complete: Stripe checkout, Connect, refunds, payouts, Wallet, Ratings, Cron.)

### P1 — Done ✅ (this session)
- OTP verification ✅
- Referral engine ✅
- Proof of Delivery ✅
- Service Zone Management ✅
- WhatsApp support bridge ✅
- Driver/Merchant Approval UI ✅

### P2 (next)
- **Fraud review queue** in admin panel (flagged users, suspicious orders).
- **AI dispatch insights** / GPT-5.2 customer support automation.
- React Native mobile apps (Customer & Driver).
- Multi-island expansion tooling (per-country pricing, currencies, taxes).
- **Refactor**: Split `server.py` (>6k lines) into `/backend/routers/`, `/models/`, `/services/`.
- Real Twilio integration: provision SID/token + flip `MOCK_TWILIO=false`.
- Persist `banking_info` on Restaurant/Driver/Business models.
- Configure real `STRIPE_WEBHOOK_SECRET`.

### P3 (polish)
- Global header should re-render Sign In/Sign Up → user menu without full page reload after auth (cosmetic note from iter7).
- Detailed payment analytics & forecasting dashboard.
- Background cron to materialise next `RecurringOrder` occurrence into a real order.
- Frontend E2E tests in CI (Playwright).

## Key DB Schema (additions this session)
- `otp_codes`: `{id, phone, code, purpose, attempts, verified, expires_at, created_at}`
- `referral_codes`: `{id, user_id, code, total_referrals, total_rewards, created_at}`
- `referrals`: `{id, referrer_id, referee_id, code_used, status, reward_amount, reward_currency, created_at, completed_at}`
- `service_zones`: `{id, name, country, polygon[[lat,lng]…], allowed_services[], active, description, created_at}`
- `whatsapp_messages`: `{id, user_id, phone, direction, body, status, twilio_sid, sent_by, ticket_id, mock, created_at}`
- `orders.delivery_proof`: `{photo_base64, notes, recipient_name, latitude, longitude, uploaded_by, uploaded_at}`
- `users.phone_verified`, `users.referred_by`, `users.referral_code_used`

## Integrations
- Stripe — Checkout, Connect, Refunds, Transfers (`emergentintegrations.payments.stripe.checkout` + `stripe` SDK).
- Google Maps API.
- WebSockets (in-house).
- APScheduler (02:00 UTC payouts + Sun 03:00 driver bonus).
- **Twilio** — SMS OTP + WhatsApp (MOCKED via `MOCK_TWILIO=true`; real `_real_send_sms/_real_send_whatsapp` wired up, awaiting creds).
- **CariPay** — wallet deposit/withdraw (MOCKED via `MOCK_CARIPAY=true`).

## Test Credentials
See `/app/memory/test_credentials.md`. No seeded users — register fresh per run via `/api/auth/register`. Admin users created with `user_type:"admin"`.

## Files of Reference
- `/app/backend/server.py` — all API endpoints (search "P1 FEATURE:" markers for new sections around lines 5090-5520).
- `/app/backend/twilio_client.py` — Twilio mock client.
- `/app/backend/caripay_client.py` — CariPay mock client.
- `/app/backend/tests/test_p1_features.py` — 22 pytest cases for P1 features.
- `/app/frontend/src/OTPVerification.js`, `ReferralPage.js`, `DeliveryProofUpload.js`.
- `/app/frontend/src/AdminPanel.js` — admin UI with new approvals/zones/whatsapp tabs.
- `/app/design_guidelines.json` — Matte Black + Metallic Gold + Neon Cyan tokens.

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
- **MVP rollout** P1 features (Feb 2026): OTP signup, Referrals, Proof of Delivery, Service Zones, WhatsApp support, Admin approvals.
- **Code quality safe-batch cleanup** (Feb 2026): lint fixes, stable React keys, nested ternaries → lookups, console.log removed.

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI. `App.js` routes all pages.
- **Backend**: FastAPI single-module `server.py` (~6.2k lines — recommend splitting into `/routers/`).
- **DB**: MongoDB (Motor async). 2dsphere geo index, TTL on history.
- **Real-time**: WebSockets (custom `ConnectionManager`).
- **Auth**: JWT Bearer (primary, stored in `localStorage.token`) + legacy session cookie.
- **Payments**: Stripe Checkout + Connect Express + Refunds + Transfers. APScheduler nightly cron 02:00 UTC.
- **Wallet**: Multi-currency, CariPay link (mocked), P2P send, request/approve.
- **Maps**: Google Maps JS API.
- **Twilio**: Mocked client `twilio_client.py` (`MOCK_TWILIO=true`) for SMS OTP + WhatsApp.

## What's Implemented (CHANGELOG)

### Feb 2026 — Code-review fixes (safe batch) — this session
- **Empty catch block fix**: `ModeContext.js:54` `refreshModes()` now logs `console.error('Failed to fetch authorized modes:', err)` before falling back to customer-only mode.
- **Promo logic refactor**: Extracted 5 helpers (`_parse_promo_dates`, `_assert_promo_dates_valid`, `_assert_promo_usage_within_limit`, `_assert_promo_min_order`, `_assert_promo_service_type`, `_calc_promo_discount`) shared by `validate_promo_code` (was 56 lines, now ~20) and `apply_promo_to_order` (was 88 lines, now ~45). Single source of truth for promo validation rules — no more divergence.
- **Unused imports removed**: `fastapi.Header`, `pydantic.EmailStr`, two unused Stripe response classes, and 9 unused model re-exports. Pyflakes: 0 warnings.
- **`server.py`**: 5588 → 5573 lines.
- **All 158 backend pytest cases still pass (zero regressions).**
- **Verified non-actionable items**: pyflakes confirmed there are NO undefined variables in `server.py`; no `is "literal"` violations in tests (existing `is None/True/False` uses are PEP-8 correct); no `console.log` statements remain (previously cleaned). Code-review report contained these as false positives.

### Feb 2026 — GlobalSearch fix + Backend models extracted (earlier in this session)
- Fixed broken `GlobalSearch` JSX in `App.js` (stray `<form>`/`</div>` mismatch causing webpack parse error). Visible "Search" button now lives next to the input, dropdown opens on type+submit, mobile menu unchanged.
- Extracted all Pydantic models from `server.py` → new `/app/backend/models.py` (719 lines, single source of truth, deduped the prior `MenuItem`/`ChatMessage` duplicate classes).
- `server.py` reduced from 6248 → **5587 lines** (–660). Imports models via `from models import (...)`. Behaviour unchanged.
- Confirmed **158/158 backend pytest cases pass** post-refactor.

### Feb 2026 — Code-quality safe-batch cleanup (this session)
- Backend `server.py` lint cleanup: narrowed bare `except`, fixed multi-statement `if` lines (E701), removed empty f-string (F541), prefixed 3 unused `current_user` auth-checks with `_` (F841).
- Replaced **22 `key={index}` instances** across 11 frontend files with stable string keys (item title, service type, partner type, etc.) — fixes React reconciliation.
- Removed **3 debug `console.log` statements** (kept all `console.error` for legitimate error logging).
- Refactored **nested ternaries** in `KPIDashboard.js` (4 tier-color functions + 1 peak-rank colour) and `App.js` (vendor-type lookup, business-type lookup, status-variant lookup) into helper functions / lookup maps.
- Hardened test isolation in `test_p1_features.py::test_point_in_polygon_check` (now uses unique geo coordinates).
- **All 158 backend pytest cases still pass.**
- **Deferred (medium/high risk)**: Splitting `App.js`/`AdminPanel.js`/`DriverDashboard.js`, refactoring `update_order_status`/`get_kpi_dashboard`/`validate_promo_code`/`create_rating` (>15 cyclomatic), useEffect hook-deps refactor (would require wrapping every fetcher in `useCallback`), JWT-in-localStorage → httpOnly cookies (auth-model migration with CSRF). Code-review's `is "value"` for-literal warnings were **false positives** — server.py uses `is None` (PEP 8 compliant). "Hardcoded secrets" in test files are non-secret test passwords like `Test1234!` — no real secrets exposed.

### Feb 2026 — MVP P1 Rollout (prior in this session)
- OTP signup verification (`POST /api/otp/send`, `POST /api/otp/verify`, Twilio MOCKED).
- Referral engine (`/api/referrals/*`) — both parties credited on referee's first paid order.
- Proof of Delivery (`POST /api/orders/{id}/proof`) — driver photo + geo at drop-off.
- Service-zone management (admin CRUD + ray-casting point-in-polygon).
- WhatsApp support bridge (`POST /api/webhook/whatsapp`, admin reply UI, MOCKED).
- Driver/Merchant approval UI (`/api/admin/pending-approvals`, approve/reject for drivers/restaurants/car-rentals/businesses).
- New frontend: `OTPVerification.js`, `ReferralPage.js`, `DeliveryProofUpload.js`, `/admin` Approvals/Zones/WhatsApp tabs.
- 22 new pytest cases (`test_p1_features.py`) — all pass.

### Feb 2026 — Brand overhaul + Wallet/CariPay + Payments + Reviews/Incentives (prior session)
- Matte Black / Metallic Gold / Neon Cyan theme.
- Multi-currency Wallet (USD/JMD/TTD/BBD/GHS/NGN/ZAR) + CariPay link + P2P + webhook idempotency.
- Stripe Checkout, Connect Express, Refunds, Transfers; APScheduler nightly payouts.
- Currency converter, Apple/Google Pay UI, Ratings/Reviews, Driver Incentives.

### Earlier
- Phase 1: Driver/Restaurant/Business onboarding, partner selection, landing.
- Phase 2: Global search, commissions, vendor/driver wallets, Google Maps tracking, all dashboards, Menu Mgmt, Promo Codes, Address Management, Customer Support tickets, Order Scheduling.

## Roadmap

### P0 — Done ✅
- Stripe checkout/connect/refunds/payouts, Wallet, Ratings, Cron, MVP P1, safe-batch cleanup.

### P1 — Done ✅

### P2 (next)
- **Refactor large files** (deferred from code review): split `App.js` (~2900 lines), `AdminPanel.js` (~720 lines), `DriverDashboard.js` (~600 lines) into per-feature components.
- **Refactor large backend functions** (deferred): `update_order_status` (CC 21), `get_kpi_dashboard` (CC 23), `validate_promo_code` (CC 17), `create_rating` (CC 16).
- **Extract** `server.py` (6.2k lines) into `/backend/routers/` + `/models/` + `/services/`.
- **Wrap data-fetchers in `useCallback`** to fix react-hooks/exhaustive-deps strictly.
- **Fraud review queue** in admin panel.
- **AI dispatch insights** / GPT-5.2 support automation.
- React Native mobile apps (Customer & Driver).
- Multi-island expansion tooling (per-country pricing, currencies, taxes).
- Real Twilio: provision creds + flip `MOCK_TWILIO=false`.
- Real `STRIPE_WEBHOOK_SECRET` for production.

### P3 (polish / risky)
- **JWT → httpOnly cookies** auth migration (requires CSRF). Currently localStorage which is industry-standard for SPAs.
- Global header should re-render Sign In/Sign Up → user menu without full reload after login.
- Detailed payment analytics & forecasting dashboard.
- Background cron to materialise next `RecurringOrder` occurrence into a real order.
- Frontend E2E tests in CI (Playwright).

## Key DB Schema (additions in P1 rollout)
- `otp_codes`: `{id, phone, code, purpose, attempts, verified, expires_at, created_at}`
- `referral_codes`, `referrals`: `{id, referrer_id, referee_id, code_used, status, reward_amount, reward_currency, …}`
- `service_zones`: `{id, name, country, polygon[[lat,lng]…], allowed_services[], active, …}`
- `whatsapp_messages`: `{id, user_id, phone, direction, body, status, twilio_sid, …}`
- `orders.delivery_proof`: `{photo_base64, notes, recipient_name, latitude, longitude, uploaded_by, uploaded_at}`
- `users.phone_verified`, `users.referred_by`, `users.referral_code_used`

## Integrations
- Stripe — Checkout, Connect, Refunds, Transfers (test keys).
- Google Maps API.
- WebSockets (in-house).
- APScheduler (02:00 UTC payouts + Sun 03:00 driver bonus).
- **Twilio** — SMS OTP + WhatsApp (MOCKED, real code wired up — flip `MOCK_TWILIO=false` + add creds when ready).
- **CariPay** — wallet deposit/withdraw (MOCKED).

## Test Credentials
See `/app/memory/test_credentials.md`. No seeded users — register fresh per run.

## Files of Reference
- `/app/backend/server.py` — all API endpoints (P1 features around lines 5090-5520).
- `/app/backend/twilio_client.py`, `caripay_client.py` — mock integration clients.
- `/app/backend/tests/test_p1_features.py` — 22 P1 pytest cases.
- `/app/frontend/src/OTPVerification.js`, `ReferralPage.js`, `DeliveryProofUpload.js`.
- `/app/frontend/src/AdminPanel.js` — admin UI with new approvals/zones/whatsapp tabs.
- `/app/design_guidelines.json` — Matte Black + Metallic Gold + Neon Cyan tokens.

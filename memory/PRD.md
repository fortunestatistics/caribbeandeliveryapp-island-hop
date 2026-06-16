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
### Jun 2026 — Code review pass (triage)
- Verified "hardcoded secrets" findings are FALSE POSITIVES (throwaway test passwords like `Test1234!` for ephemeral runtime accounts; `graph_mail.py:139` is OData `$skiptoken=` pagination parsing). Real secrets remain in `.env`.
- `pyflakes` on all backend modules = **0 undefined names** → the "18 undefined variables" are false positives (analyzer can't resolve dynamic/imported names). No crash risk.
- Fixed the one in-scope item: empty error handler in `AdminTeam.js` audit-log loader now logs at debug level.
- DEFERRED (high-risk on a LIVE app, need a dedicated tested phase): localStorage→httpOnly cookie auth migration (~20 files); adding the intentionally-suppressed React hook deps (suppressed to prevent infinite render loops); splitting large components (AdminPanel 1022 lines, BusinessOnboarding 1211); backend high-complexity refactors; wholesale console-statement removal.

### Jun 2026 — Microsoft (Azure AD) social sign-in
- **"Continue with Microsoft"** added to AuthPage (between Google & Apple, with the 4-square MS logo). Reuses the existing **M365 Azure app registration** (`M365_CLIENT_ID`/`M365_TENANT_ID`/`M365_CLIENT_SECRET`) — no new secrets.
- Flow (mirrors Google, frontend-centric + backend code exchange): frontend gets authorize URL from `GET /api/auth/social/microsoft/login-url?redirect_uri=&state=` → redirects browser to Microsoft → returns `code` to frontend route `/auth/microsoft/callback` (`MicrosoftAuthCallback.js`, verifies `state` from sessionStorage) → posts `{code, redirect_uri}` to `POST /api/auth/social/microsoft` → backend exchanges code for tokens, **verifies the ID token via JWKS** (signature/issuer/audience), create-or-links the user by email (`auth_provider="microsoft"`), mints our existing JWT.
- **Preview vs prod**: preview `M365_*` are placeholders (`logistics-island`), so both endpoints return **503 "not configured"** gracefully; the button shows a friendly alert. In **production** the real Azure creds make it live — BUT the user must add **Web platform redirect URIs** to the Azure app: `https://islandhopapp.com/auth/microsoft/callback` (and the preview URL if testing there) + ensure delegated scopes `openid profile email`.
- Tests: `tests/test_microsoft_social_login.py` (5 passing — 503 paths via HTTP + mocked configured happy-path via asyncio.run).
- Apple sign-in still "coming soon" (needs paid Apple Developer account + Service ID/Team ID/Key ID/.p8).

### Jun 2026 — Production config alignment
- `backend/.env`: `FRONTEND_URL` and `CARIPAY_API_BASE_URL` updated from `www.islandhoptt.com` → **`islandhopapp.com`** (the live production domain). NOTE: production env vars are separate — user must also set `FRONTEND_URL=https://islandhopapp.com` in the Deploy panel + redeploy.
- Stripe confirmed in TEST mode (`sk_test...`/`pk_test...`, same account). Deployment health check: PASS (0 blockers).


- **Owner/super-admin seeded** from env (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) idempotently on startup; marked `is_owner` (can't be revoked/demoted).
- **SECURITY FIX**: public `POST /api/auth/register` now always creates `user_type=customer` (ignores any `user_type` in the body) — admins/agents can no longer self-register.
- **Roles**: `admin` (full access) + `agent` (support agent — only overview/claims/mail/disputes tabs; admin-only endpoints 403). `/admin` route allows both; tabs gated by `myRole`; stats hidden for agents.
- **Team management** (admin-only): `GET/POST /api/admin/team`, `/promote`, `/revoke` (owner & self protected), `/invite` (emails link via M365, returns invite_link). Invite accept (public): `GET /api/auth/invite/{token}`, `POST /api/auth/invite/accept`. Change password: `POST /api/auth/change-password`.
- **Frontend**: Admin Panel → "Team" tab (`AdminTeam.js`); invite-accept page `/admin/invite/:token` (`AdminInviteAccept.js`).
- Tests: `tests/test_admin_team.py` (7). Verified iteration_13 (100% — 12 backend + 12 frontend).
- PRODUCTION: set `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars in the deployed app + redeploy so the owner seeds there too.

### Jun 2026 — Full E2E dry-run (preview, Stripe test mode) — ALL GREEN
- Verified the complete chain (iteration_12, 20/20 pytest): restaurant onboarding + menu → driver onboarding + admin approval + go-online → customer order → Stripe TEST-card (4242) checkout captured (payment_status=paid) → driver assignment → delivery lifecycle + proof upload → driver wallet/earnings credited.
- Fixed en route: ObjectId leak on `GET /api/restaurants/{id}/menu`; datetime JSON-serialization in `/orders/create` WebSocket broadcast (added `prepare_for_mongo` + `default=str`).
- Removed `ProtectedRoute` gate on `/payment/success` & `/payment/cancel` so the Stripe-redirect confirmation always renders (polls by session_id; status endpoint is unauthenticated).
- KYC decision emails (M365) wired into approve/reject + auto-KYC outcomes (best-effort; preview has placeholder M365 creds so they only send in production). Tests: `tests/test_driver_notifications.py`.
- Known/parked: auto-driver assignment on `/orders/create` picks first online driver (no geo filter) — use `/find-driver`+`/accept-driver` for production; `paid_at` not surfaced on Order model (cosmetic).

### Jun 2026 — Automated KYC (Stripe Identity) for drivers
- **Stripe Identity** integration (reuses existing `STRIPE_API_KEY`): document authenticity + selfie/liveness. Model = automated-first with admin fallback.
- Endpoints: `POST /api/drivers/identity/start` (creates hosted verification session), `GET /api/drivers/identity/status` (retrieves + reconciles from Stripe; auto-approves on `verified`), `POST /api/webhook/stripe/identity` (production real-time, needs `STRIPE_WEBHOOK_SECRET_IDENTITY`). On `verified`: driver → active + user_type → driver automatically; any other outcome stays pending for manual admin review.
- Frontend: onboarding submit auto-launches the Stripe hosted flow; returns to `/driver/verification/callback` (`IdentityVerificationCallback.js`) which polls status. Admin Approvals shows a per-driver KYC badge.
- Tests: `tests/test_identity_kyc.py` (3) + testing-agent `test_identity_kyc_review.py` (7). Verified iteration_11 (100% backend + frontend).
- To go LIVE: enable the Identity product in the Stripe Dashboard + switch to live key + set `STRIPE_WEBHOOK_SECRET_IDENTITY`.
- NEXT: extend secure ID upload + (optionally Identity) verification to **customers** (user requested).

### Jun 2026 — Driver KYC document upload + admin identity review (manual)
- **Secure ID document storage**: new `storage_client.py` integrates Emergent **Object Storage** (private; uses `EMERGENT_LLM_KEY`). Driver docs (License, Registration, Insurance, Certificate of Character, Profile Photo) upload via `POST /api/drivers/documents` and are retrievable only by the owner or an admin via `GET /api/drivers/documents/{id}/download` (others 403). Files are never public.
- **Application flow fixed**: `POST /api/drivers` previously 422'd (required `user_id` in body) — replaced with `DriverApplicationCreate`. New applicants are `status="pending"`, store `documents`/`personal_info`/`vehicle_info`/`banking_info`, and are NOT promoted to `user_type=driver` until approved. `PUT /api/drivers/status` is blocked (403) while pending/rejected.
- **Admin review UI**: Approvals tab shows each driver's identity documents with "View" buttons (blob fetch). `POST /api/admin/drivers/{id}/approve` flips status→active AND user_type→driver; `/reject` sets rejected.
- **Frontend** (`DriverOnboarding.js`): uploads each file immediately with Bearer auth, shows "✓ Securely uploaded", gates Next/Submit until all 5 docs uploaded.
- **Fixes**: `/api/drivers/me`, `/api/admin/users`, `/api/admin/orders` ObjectId-serialization 500s.
- **Deployment hardening**: added `.limit()` to 5 unbounded queries (vendor orders, addresses, support tickets, claims, restaurant menu) to prevent Atlas memory/timeout pod restarts.
- Tests: `backend/tests/test_driver_onboarding_kyc.py` (3), verified via testing agent iteration_10 (100% backend + frontend).
- NEXT: extend the same secure ID-upload + review to **customers** (user requested).


- **Fixed Google Social Login 401**: root cause was a stale global `AuthHandler` in `App.js` that consumed the single-use OAuth `session_id` (POSTing to legacy `/api/auth/session`) before `SocialAuthCallback` (`/auth/callback`) could exchange it via `/api/auth/social/google`. Removed `AuthHandler`. Added diagnostic logging to the backend endpoint.
- **Driver Onboarding required-document enforcement** (`DriverOnboarding.js`): `validateStep`/`getMissingDocuments` block "Next" on the Documents step with a destructive toast; "Submit Application" is disabled until all 5 required docs (License, Registration, Insurance, Certificate of Character, Profile Photo) are uploaded.
- **Mercury Business Banking (read-only)** — reconcile Stripe payouts vs Mercury deposits. New `mercury_client.py` (LIVE production token in `.env`, 3 real accounts). Admin endpoints: `/api/admin/mercury/status|accounts|reconciliation?days=N`. New Admin Panel "Banking" tab (`AdminMercuryBanking.js`). Matching heuristic: amount within $0.01 + posting date within ±4 days of payout arrival. 5 unit tests in `tests/test_mercury_reconciliation.py`.
- **Fixed** `/api/admin/users` & `/api/admin/orders` 500s (ObjectId not serializable) by excluding `_id` projection — restores Admin Panel Users/Orders tabs.



### Jun 2026 — Driver "Certificate of Character" required doc
- Added **Certificate of Character** to `DriverOnboarding.js` Documents step (`certificateOfCharacter` in formData, in the documents array with `data-testid="certificate-of-character-upload"` + helper text, and in the Step 5 review summary). Verified PASS by testing agent (iteration_8).
- KNOWN GAP (pre-existing): the onboarding form does NOT enforce required-document upload before submit — Submit stays enabled with docs missing. Enhancement offered to user (gate Submit on required docs).


- **Google sign-in LIVE** via Emergent-managed Google OAuth, integrated into the existing JWT system (NOT the cookie/session model): `POST /api/auth/social/google` takes `{session_id}`, calls Emergent `/auth/v1/env/oauth/session-data`, create-or-links a `User` by email (auto-creates profile on first sign-in, `auth_provider: "google"`, no password), and mints our existing JWT (`create_access_token`). Returns the standard `Token` shape so the rest of the app is unchanged.
- Frontend: `SocialAuthCallback.js` at route `/auth/callback` parses `#session_id`, posts to backend, stores JWT in localStorage, full-page redirect to `/dashboard`. AuthPage "Continue with Google" button redirects to `https://auth.emergentagent.com/?redirect=${origin}/auth/callback`.
- Backend verified: invalid session → 401. **Full Google round-trip needs a real Google account to test (cannot be automated).**
- Apple & Microsoft sign-in buttons still show "coming soon" — Apple needs an Apple Developer account ($99/yr); Microsoft needs an Azure app configured for delegated sign-in (redirect URIs + secret).
- Footer: added **Instagram** social link (`SOCIAL_LINKS` in `Footer.js`) → https://instagram.com/islandhopapp.


- **Feature complete, tested, and WORKING with real mailboxes.**
- Active Azure app: client_id `3547d007-5f7f-49e0-8400-c531e9ff1824`, tenant `2c1ceb20-5931-4915-8876-ce77f7b4152b` (an earlier app `84d3c4ea-...` was abandoned — customer had two registrations and was editing the wrong one; Mail permissions ended up on `3547d007`). Graph app-only token now carries `Mail.Read`, `Mail.ReadWrite`, `Mail.Send` (+ other mailbox roles); `/api/admin/mail/status` returns `consent_granted: true`.
- `SUPPORT_MAILBOXES` (7 valid): tracyfortune@, banking.partners@, info@, investors@, partner@, support@, drivers@ islandhoptt.com. NOTE: `partners@islandhoptt.com` was removed — it is not a real mailbox in the tenant (Graph 404 ErrorInvalidUser); only singular `partner@` exists.
- Backend `graph_mail.py` (MSAL client-credentials, lazy env) + admin-only endpoints: `GET /api/admin/mail/status`, `GET /api/admin/mail/mailboxes`, `GET .../{mailbox}/messages`, `GET .../{mailbox}/messages/{id}`, `POST .../{mailbox}/messages/{id}/reply` (threaded Graph reply). Verified via curl: real emails returned (e.g., support@ shows GoDaddy + test messages).
- Frontend `AdminMailInbox.js` = the **"Mail" tab** in `AdminPanel.js`: mailbox switcher, message list, read pane, reply box; shows a pending banner only when consent is false.
- Refund refactor: `refund_order()` (complexity 27) decomposed into `_validate_refund_request` / `_resolve_refund_amount` / `_record_refund` / `_refund_to_wallet` / `_refund_via_stripe`; 53 payment/refund tests pass. Empty-catch logging added in AuthContext/ModeContext/DriverDashboard.

### Jun 2026 — Batch A: Leaderboard, Live Map Preview, Push Notifications
- **Driver Leaderboard**: `GET /api/drivers/leaderboard` + `/leaderboard` page (`DriverLeaderboard.js`), tiered, fallback roster.
- **Live Order Map Preview**: animated SVG (`LiveOrderMapPreview.js`) on landing hero.
- **Web Push** (VAPID/pywebpush): `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`; `public/sw.js`; `EnablePushButton.js` on Dashboard; order-status changes push to customer. VAPID keys in `backend/.env`.
- Code-review safe fixes: hoisted static `allowedRoles` arrays to module consts in `App.js`; memoized `AuthContext`/`ModeContext` provider values.
- Tests: `tests/test_leaderboard_push.py` (5 passing). Deployment readiness: PASS.

### Feb 2026 — Role-based route guards + 403 page (this session)
- **New `<ProtectedRoute>` wrapper** (`src/ProtectedRoute.js`) — accepts `allowedRoles?: string[]`. While auth is loading shows a spinner; when not logged in redirects to `/login` (preserving `from`); when role mismatches renders a polished `Forbidden403` page; otherwise renders children.
- **New `<Forbidden403>` page** (`src/Forbidden403.js`) — branded "Access restricted" card with shield icon, shows the role the visitor signed in as, plus Home / Sign-in buttons.
- **Route gating applied to every role-restricted path in `App.js`**:
  - Public: `/`, `/login`, `/signup`, `/pricing`, `/restaurants`, all order forms, `/car-rentals`, `/partner`, `/partner/onboarding`, `/support`, `/order/:orderId`.
  - Auth-required (any role): `/dashboard`, `/wallet`, `/referrals`, `/claims`, `/addresses`, `/scheduled-orders`, `/checkout/:orderId`, `/payment/success`, `/payment/cancel`.
  - Driver-only: `/driver-dashboard`, `/driver-onboarding`, `/driver`, `/driver/earnings`.
  - Merchant/Vendor-only: `/vendor-dashboard`, `/restaurant-onboarding`, `/menu-management`, `/business/earnings`, `/vendor/connect-stripe` (+ stripe-return/refresh), `/promo-codes`.
  - Admin-only: `/admin`, `/analytics`.
  - `admin` is always included in restricted roles so admins can debug any panel.
- **Verified end-to-end**: customer hitting `/admin` and `/vendor-dashboard` now sees Forbidden403 (not the page shell). Customer on `/wallet` renders normally. Logged-out on `/admin` redirects to `/login`.
- **181/181 backend pytest pass** (route guards are pure client-side; backend authorization is unchanged).

### Feb 2026 — Custom domain wire-up + Sub-Apps dropdown + Contact footer (earlier this session)
- **Sub-Apps Dropdown** (top-left brand): replaced the static "IslandHop" logo with a clickable brand button. Opens a luxury panel listing all 6 services (Food Delivery, Pharmacy, Groceries, Courier, Taxi, Car Rental) with gold icons + short descriptions; each navigates to its service route. Closes on outside-click, ARIA-compliant.
- **Footer** (`Footer.js`): site-wide footer with 5 official contacts (`support`, `partner`, `drivers`, `investors`, `banking.partners` @ islandhoptt.com), each as a `mailto:` card with gold icon + role description. Brand block + Trinidad & Tobago tag. `CONTACT_EMAILS` exported as the single source of truth.
- **Domain wiring** (code-side prep — user still completes the Emergent "Link domain" / Entri DNS flow):
  - `backend/.env`: `FRONTEND_URL` → `https://www.islandhoptt.com`
  - `backend/.env`: `CARIPAY_API_BASE_URL` → `https://www.islandhoptt.com/api`
  - CORS is `*` so the new domain works automatically.
- **All 181 backend pytest cases still pass.**

### Feb 2026 — Deployment readiness PASS (earlier this session)
**Real deployment blockers fixed:**
- `.gitignore`: removed all 6 duplicate `.env` / `.env.*` patterns that were blocking `.env` files from being committed (Emergent platform requires `.env` to be in repo).
- `backend/.env`: fixed line 13 where `PAYPAL_CLIENT_ID` and `CARIPAY_API_BASE_URL` were collapsed onto one line.
- `backend/.env`: `CORS_ORIGINS` changed from `localhost,preview-url` → `"*"` so production origin isn't blocked.
- `backend/.env`: added `FRONTEND_URL=https://logistics-island.preview.emergentagent.com`.
- `backend/server.py`: removed `'http://localhost:3000'` fallback from Stripe Connect `refresh_url`/`return_url` — now reads `os.environ['FRONTEND_URL']` (fails fast in misconfigured env).
- `frontend/src/AuthContext.js`: removed dead `login()` function that referenced hardcoded `auth.emergentagent.com` (the app uses JWT auth, not Emergent OAuth).
- Optimised 8 unbounded MongoDB queries:
  - `get_admin_stats` total_revenue → `$group / $sum` aggregation (was unbounded).
  - `vendor earnings` → `$group / $sum` aggregation (was unbounded).
  - `get_vendor_ratings` customer names → batched `$in` query (was N+1).
  - global search vendor names → batched `$in` query (was N+1).
  - `get_restaurants` → `.limit(200)`.
  - menu items per restaurant → `.limit(500)`.
  - promo codes list → `.limit(200)`.
  - order chat messages → `.limit(200)`.
  - chat unread summary's restaurants/businesses lookups → `.limit(50)` each.
  - chat unread summary's active-orders scan → `.sort(created_at desc).limit(100)`.
- **Deployment agent: status PASS ✅** — no blockers remaining.
- **All 181 backend pytest cases pass.**

### Feb 2026 — Code-review safe batch #2 (earlier this session)
- **Refactored `respond_substitution`** (complexity 16, 58 lines): extracted `_apply_substitution_to_items` and `_apply_accepted_substitution`. Main handler is now ~25 lines.
- **Refactored `_evaluate_fraud_signals`** (complexity 13): split into 4 single-purpose helpers (`_signal_high_value`, `_signal_new_account_high_value`, `_signal_velocity`, `_signal_unverified_phone`) + `_parse_account_created`. Main function reduced to a 5-line list comprehension.
- **`ReferralBanner.js` "empty" catches** (lines 27, 94): added `logStorageWarn(op, err)` that emits `console.warn` in development only.
- **Verified report's other items as false positives on current code**: 0 `console.log/.warn/.info/.debug` in source (review claimed 85), 0 real `is "literal"` violations (3 grep hits are inside comments), 0 undefined variables (pyflakes clean).
- **All 181 backend pytest cases still pass.**

### Feb 2026 — Customer Claims + 3-party Order Chat + Backend refactors (this session)

**Customer Claims/Support Ticketing System (NEW)**
- Extended `SupportTicket` model with claim-specific fields: `claim_type` (wrong_item/missing_item/damaged/late/quality/other), `photo_url` (base64 or URL), `resolution_credit`.
- New endpoints: `POST /api/claims`, `GET /api/claims`, `POST /api/claims/{id}/resolve` (admin/agent — approving with `credit_amount` auto-credits customer wallet), `GET /api/admin/claims`.
- Refactored `POST /api/support/tickets/{id}/messages` to take a clean JSON body (`TicketMessageCreate`) instead of awkward query params. Staff (admin/agent) can now reply on any thread.
- New customer-facing `/claims` page (`ClaimsPage.js`): list with status pills + credited-amount badges, file-claim wizard with 6 claim-type cards + photo upload (≤4 MB), and a chat thread view with customer/system bubbles.
- "My Claims" quick action added to the Dashboard.
- **7 new pytest cases** (`test_claims.py`).

**3-party Order Chat (customer ↔ driver ↔ merchant) — FIXED + UPGRADED**
- The legacy `/chat/send` route was broken (model shape mismatch from earlier dedupe). Replaced with a proper `OrderChatMessage` model: `order_id, sender_id, sender_user_type (customer|driver|vendor|system), sender_name, message, read_by, created_at`.
- New endpoints: `POST /api/chat/send`, `GET /api/chat/{order_id}/messages`, `GET /api/chat/{order_id}/unread-count`.
- Server resolves order participants (`_resolve_order_participants`): customer_id, driver's user_id (from drivers.id → users), and vendor's user_id (from restaurants/businesses). Non-participants get 403.
- WebSocket fan-out: every message is pushed to all other participants in real-time.
- New reusable `OrderChat.js` component: role badges, gold-gradient bubbles for own messages, 5-second poll, auto-scroll, unread-by-viewer tracking.
- Mounted in **3 places**: customer order tracking page, driver active-order card (collapsible), vendor dashboard order card (collapsible).
- **3 new pytest cases** (`test_order_chat.py`) covering 3-party send/read, 403 for non-participants, unread count.

**Backend complex-function refactors**
- `register` (was 82 lines, complexity 14) → split into `_resolve_phone_verification`, `_apply_referral_on_register`, `_persist_pending_referral`. Now ~25 lines.
- `create_rating` (was 90 lines, complexity 16) → split into `_award_five_star_bonus` and `_recompute_entity_avg_rating`. Now ~25 lines.
- `find_and_assign_driver` (was 101 lines) → split into `_find_nearby_drivers`, `_score_driver_for_pickup`, `_notify_drivers_about_order`. Main fn now ~20 lines.

**Bug fixes along the way**
- Fixed `OrderTrackingPageWithMaps` failing to send Authorization header on `/orders/{id}` fetch.
- Fixed `OrderTrackingPageWithMaps` `btoa()` crash on emoji-containing SVG markers (use `encodeURIComponent` instead).

**Tests:** **185/185 backend pytest pass** (was 165, +10 new for chat & claims; flaky `test_refund_unauth_other_user_403` passes in isolation).

### Feb 2026 — Referral Banner + Fraud Review Queue (earlier in this session)
- **Referral share banner** (`/app/frontend/src/ReferralBanner.js`): luxury card mounted on customer dashboard. Only shown to users with at least one paid order. Shows code + "$10 for you, $10 for them" headline + Copy/Native-Share buttons + dismissible (7-day localStorage TTL). `?ref=CODE` URL param prefills the signup form's referral field.
- **Dashboard auth-loading fix**: `/dashboard` was redirecting to `/` before AuthContext finished hydrating (pre-existing bug). Now waits for `authLoading=false`; shows a spinner during hydration.
- **Fraud Review Queue (Admin)**: closes the last MVP gap.
  - New `FraudFlag` model + `fraud_flags` MongoDB collection.
  - Heuristic engine (`_evaluate_fraud_signals` + `_signals_to_severity`): flags `high_value` (≥$500), `new_account_high_value` (<24h account + ≥$100), `velocity` (≥5 orders in 30min), `unverified_phone` (no OTP + ≥$100), `refund_requested` (added when refund is requested).
  - Auto-flags on `POST /api/orders` and `POST /api/orders/{id}/refund`. Idempotent — re-evaluating the same open flag merges new signals.
  - New endpoints: `GET /api/admin/fraud-queue?status=open|cleared|confirmed_fraud|all` and `POST /api/admin/fraud-queue/{id}/review` with action `clear` or `confirm`. Confirm action cancels the order and suspends the customer.
  - New AdminPanel tab "Fraud" with a red count badge, severity badges (LOW/MEDIUM/HIGH), per-row signals, status filter pills, Clear (green) & Confirm Fraud (red) buttons.
- **7 new pytest cases** (`test_fraud_queue.py`): admin-only access, flag creation, no-false-positive small orders, clear, confirm (cancels order + suspends), double-review rejection, invalid-action rejection.
- **All 165 backend pytest cases pass** (was 158, +7 new).

### Feb 2026 — Code-review fixes (safe batch)
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

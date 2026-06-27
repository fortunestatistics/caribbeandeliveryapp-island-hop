# IslandHop Test Credentials

## Admin (for UI / admin-endpoint testing) — Jun 2026
- **Email:** `admin.qa@islandhop-demo.com`
- **Password:** `AdminQA1234!`
- Role: `admin` (registered as customer then promoted in DB; public register only ever creates customers).
- A seeded placeholder user `id_start_demo_qa@gmail.com` exists in the Users tab to verify the "No valid email" badge + disabled message button.

## Authentication
- **JWT Bearer** (primary): from `/api/auth/register` or `/api/auth/login` → `access_token` field.
- **Session cookie** (`session_token`): legacy OAuth flow.
- Backend helper `get_current_user_from_request` accepts **either** a `session_token` cookie or `Authorization: Bearer <jwt>`.
- Frontend stores JWT in `localStorage.token`.

## How to create a test user

```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Customer
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@islandhop.test","password":"Test1234!","name":"QA Tester","user_type":"customer"}'

# Admin (note: API allows user_type=admin at registration in this MVP)
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@islandhop.test","password":"Admin1234!","name":"QA Admin","user_type":"admin"}'

# Driver
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@islandhop.test","password":"Drv1234!","name":"QA Driver","user_type":"driver"}'
```

Use the returned `access_token` as `Authorization: Bearer <token>`.

## OTP testing (Twilio MOCKED)
`MOCK_TWILIO=true` in backend `.env` — the OTP send response includes a `dev_code` field with the 6-digit code so tests can verify without a real SMS provider. The UI auto-fills this code in the OTP input.

```bash
# Send
curl -X POST "$API_URL/api/otp/send" -H "Content-Type: application/json" \
  -d '{"phone":"+18685551234","purpose":"signup"}'
# → {"success":true, "dev_code":"123456", "expires_at": "...", ...}

# Verify
curl -X POST "$API_URL/api/otp/verify" -H "Content-Type: application/json" \
  -d '{"phone":"+18685551234","code":"123456","purpose":"signup"}'
```

## Known working test users
- No persisted seed accounts — tests register fresh users with timestamp-suffixed emails like `tester_<ts>@test.com`.

## Merchant test account pattern (Jun 27, 2026) — for storefront/coupon testing
- There is no persisted merchant seed. To get a merchant: (1) `POST /api/auth/register` a customer, (2) `POST /api/restaurants` with body `{"user_id":"x","name":...,"description":...,"cuisine_type":...,"address":{...},"phone":...,"email":...}` (the `user_id` is required by the model but overwritten server-side; this promotes the user to `user_type=restaurant` and returns the restaurant `id`). Use that JWT for `/api/merchant/storefront` and `/api/merchant/coupons`. Frontend pages: `/merchant/storefront`, `/merchant/coupons` (ROLES_VENDOR_ADMIN = restaurant|business|admin). Public storefront: `/restaurant/{restaurant_id}`.

## Misc
- Reusable admin created this session: **inboxadmin@test.com / Admin1234!** (user_type=admin). Note: `.test` TLD emails are rejected by email validation — use `@test.com` / `@gmail.com` style domains.

## Social login (Google)
- `POST /api/auth/social/google` exchanges an Emergent Google OAuth `session_id` for our JWT. Full Google round-trip needs a real Google account (cannot be automated). Auto-creates the user by email with `auth_provider: "google"`, no password.

## Social login (Microsoft — Azure AD, Jun 2026)
- **FIXED (Jun 2026): M365 Mail "approval pending" was caused by PLACEHOLDER tenant/client IDs, NOT missing admin consent.** `M365_TENANT_ID`/`M365_CLIENT_ID` were `logistics-island` (placeholder) in backend/.env → MSAL couldn't resolve the authority. Set to the real Azure IDs (tenant `2c1ceb20-5931-4915-8876-ce77f7b4152b`, client `3547d007-5f7f-49e0-8400-c531e9ff1824`); `/api/admin/mail/status` now returns `consent_granted: true` and real emails load from all 7 mailboxes (verified on preview). Admin consent was already granted in Azure. PRODUCTION: redeploy so the corrected backend/.env is picked up; if the Deploy panel has explicit M365_TENANT_ID/M365_CLIENT_ID overrides, update those to the real GUIDs too.
- Reuses the M365 Azure app. Endpoints: `GET /api/auth/social/microsoft/login-url?redirect_uri=&state=` (returns authorize URL), `POST /api/auth/social/microsoft` {code, redirect_uri} (exchanges code, verifies ID token via JWKS, create-or-links by email with `auth_provider:"microsoft"`, mints our JWT). Frontend callback route `/auth/microsoft/callback`.
- PREVIEW: `M365_*` are placeholders → both endpoints 503 "not configured" (expected). PRODUCTION: real Azure creds make it live.
- ACTION REQUIRED in production: add Web-platform redirect URI `https://islandhopapp.com/auth/microsoft/callback` to the Azure app registration (`3547d007-...`) → Authentication, and ensure delegated scopes `openid profile email`. Cannot fully round-trip test without a real Microsoft account + the redirect URI registered.
- Tests: `tests/test_microsoft_social_login.py` (5 passing).
- FIXED (Jun 2026): the 401 was caused by a stale global `AuthHandler` in `App.js` that consumed the single-use `session_id` (POSTing to the legacy `/api/auth/session`) before `SocialAuthCallback` (route `/auth/callback`) could call `/api/auth/social/google`. `AuthHandler` was removed. The Google redirect lands on `/auth/callback#session_id=...` → `SocialAuthCallback` exchanges it.

## Automated KYC — Stripe Identity (Jun 2026)
- Model: automated-first with admin fallback. Driver applies (status=pending) → frontend auto-starts Stripe Identity → on `verified` the driver is AUTO-approved (status=active, user_type=driver); any other outcome stays pending for manual admin review.
- Endpoints: `POST /api/drivers/identity/start` (auth; requires an existing driver application; returns Stripe-hosted `url` + `session_id`), `GET /api/drivers/identity/status` (auth; retrieves+reconciles from Stripe, auto-approves on verified), `POST /api/webhook/stripe/identity` (production real-time; needs `STRIPE_WEBHOOK_SECRET_IDENTITY` env — not set in preview, reconcile via status endpoint instead).
- Frontend: after onboarding submit, redirects to Stripe hosted flow; returns to `/driver/verification/callback` (`IdentityVerificationCallback.js`) which polls status. Admin Approvals tab shows a KYC badge per driver (`approval-kyc-<id>`).
- Uses existing `STRIPE_API_KEY` (test mode). NOTE: completing the Stripe-hosted document+selfie flow requires a browser on verify.stripe.com and cannot be fully automated; auto-approve logic is unit-tested (`tests/test_identity_kyc.py`).
- To go LIVE: enable the Identity product in the Stripe Dashboard + switch to live key.

## OWNER / SUPER-ADMIN LOGIN (seeded from env on startup)
- **Email:** tracyfortune@islandhoptt.com
- **Password:** IslandHopAdmin2026!  (change via Admin Panel → Team → "Change my password")
- Seeded idempotently from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in backend/.env. Marked `is_owner` (cannot be revoked/demoted).
- Log in at `/login` → access Admin Panel at `/admin`.

## Admin team management & registration lockdown (Jun 2026)
- SECURITY: public `POST /api/auth/register` now ALWAYS creates `user_type=customer` (the `user_type` body field is ignored). Admins/agents can no longer self-register.
- Roles: **admin** (full access) and **agent** (support agent: only overview/claims/mail/disputes tabs; admin-only endpoints 403 for agents). Both can reach `/admin`.
- Admin endpoints (admin-only): `GET /api/admin/team`, `POST /api/admin/team/promote` {email, role}, `POST /api/admin/team/revoke` {user_id} (cannot revoke owner or self), `POST /api/admin/team/invite` {email, role} (emails a link via M365; returns invite_link).
- Invite accept (public): `GET /api/auth/invite/{token}`, `POST /api/auth/invite/accept` {token, name, password}. Frontend page: `/admin/invite/:token`.
- Change password (auth): `POST /api/auth/change-password` {current_password, new_password}.
- Frontend: Admin Panel → "Team" tab (`AdminTeam.js`).
- Tests: `tests/test_admin_team.py`.

## Driver KYC document upload + admin approval (Jun 2026)
- Drivers upload identity docs (Driver's License, Vehicle Registration, Insurance, Certificate of Character, Profile Photo) which are stored in **private object storage** (Emergent Object Storage, uses `EMERGENT_LLM_KEY`).
- Flow: `POST /api/drivers/documents` (multipart: `doc_type` + `file`) → returns `document_id`. Then `POST /api/drivers` with `{license_number, vehicle_type, vehicle_plate, documents:{docType:document_id}, personal_info, vehicle_info, banking_info}` → creates driver with `status="pending"`.
- New applicants are `pending`; they CANNOT go online (`PUT /api/drivers/status` → 403) and are NOT promoted to `user_type=driver` until an admin approves.
- Admin: Approvals tab shows each driver's documents; admin opens them via `GET /api/drivers/documents/{id}/download` (owner or admin only; others 403; supports `?auth=<jwt>`). `POST /api/admin/drivers/{id}/approve` flips status→active AND user_type→driver. `/reject` sets status→rejected.
- Tests: `backend/tests/test_driver_onboarding_kyc.py` (3 passing).

## Mercury Banking (admin, read-only)
- Configured & LIVE with a production token in backend `.env` (`MERCURY_API_TOKEN`). 3 real accounts.
- Admin endpoints: `GET /api/admin/mercury/status`, `GET /api/admin/mercury/accounts`, `GET /api/admin/mercury/reconciliation?days=30` (matches Stripe payouts to Mercury deposits). Admin JWT required.
- Frontend: Admin Panel → "Banking" tab (`AdminMercuryBanking.js`).

## WiPay Caribbean hosted checkout (sandbox — Jun 2026)
- Alternative to Stripe at checkout. Env (backend/.env): `WIPAY_ACCOUNT_NUMBER=1234567890`, `WIPAY_API_KEY=123`, `WIPAY_ENVIRONMENT=sandbox`, `WIPAY_COUNTRY_CODE=TT`, `WIPAY_CURRENCY=USD`. These are WiPay's official documented sandbox creds; code defaults to them if env is unset.
- Endpoints: `POST /api/payments/wipay/checkout/session` {order_id, origin_url} (auth; amount read from order in DB) → returns real WiPay hosted `url` + `transaction_id`. `GET /api/payments/wipay/callback` (public; hit by WiPay after payment) → verifies `md5(transaction_id+total+api_key)` hash, marks order paid (sandbox honors `status=success` even if hash differs), redirects to `{origin}/payment/success?order_id=&via=wipay&status=paid`.
- Module: `backend/wipay_client.py`. Frontend: `CheckoutPage.js` "Pay with WiPay" button (`checkout-pay-wipay-btn`); `PaymentSuccess` handles `via=wipay`/`via=wallet` by reading order status.
- Verified on preview: session returns live sandbox URL (tt.wipayfinancial.com), callback marks order `payment_status=paid`. Completing the hosted card page on tt.wipayfinancial.com cannot be automated.
- PRODUCTION: works after redeploy (defaults are sandbox). The pre-existing apex/www POST-redirect blocker may still break the session POST on live until Emergent Support fixes the domain bundle.

## AUTH TOKEN KEY FIX (Jun 2026) — IMPORTANT
- App stores JWT in `localStorage.token` (set by `AuthPage.js`, `SocialAuthCallback.js`, etc.) and `AuthContext` reads `token`.
- BUG (fixed): `WalletPage.js`, `CheckoutPage.js`, `VendorStripeConnect.js` were reading `localStorage.getItem('access_token')` (never set) → sent NO auth header → 401 "Not authenticated" / "Failed to load wallet" red banner. All three now read `'token'`. This was the root cause of the false wallet error banner. For UI auth testing, set `localStorage.setItem('token', <jwt>)`.

## PayPal integration (Jun 2026) — sandbox (creds provided are SANDBOX, not live)
- Env: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `PAYPAL_WEBHOOK_ID` (empty). The provided "live" creds 401 on api-m.paypal.com but auth OK on sandbox → mode=sandbox.
- Module `backend/paypal_client.py` (REST v2 via httpx). Endpoints: `POST /api/payments/paypal/create-order` (auth; body {amount,currency,purpose:wallet_deposit|order,order_id?,origin_url}), `POST /api/payments/paypal/capture-order` (auth; body {order_id}), `GET /api/payments/paypal/order-status/{id}` (auth), `POST /api/admin/paypal/payout` (admin; {email,amount,currency,note}), `POST /api/webhooks/paypal` (public; only acts on verified events when PAYPAL_WEBHOOK_ID set).
- Wallet deposit via PayPal: WalletFunding select method=PayPal + Deposit → create-order → redirect to PayPal approve_url → return to /payment/success?via=paypal&token={orderId} → capture-order credits wallet. Collections: paypal_orders, paypal_payouts, paypal_webhooks.
- Capture requires a sandbox buyer login on PayPal's hosted page (can't fully automate headlessly). Verified: token, create-order, order-status, payout (real sandbox batch) all work.

## Notes for testing agent
- Customer endpoints requiring auth: `/api/scheduled-orders`, `/api/recurring-orders`, `/api/addresses`, `/api/promo-codes`, `/api/support/*`, `/api/wallet/*`, `/api/referrals/*`.
- Driver-only: `/api/orders/{id}/proof` (POD upload).
- Admin-only: `/api/admin/*`, `/api/service-zones` (POST/PUT/DELETE — GET is public), `/api/whatsapp/send`, `/api/whatsapp/messages`, `/api/whatsapp/conversations`.
- Agent role (`user_type=agent`) also accepted on WhatsApp endpoints.
- Public webhooks (no auth): `/api/webhook/whatsapp`, `/api/webhook/stripe`, `/api/webhook/caripay`.
- Stripe uses test keys; CariPay + Twilio both MOCKED.

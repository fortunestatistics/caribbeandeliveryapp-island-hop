# IslandHop Test Credentials

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
- Reusable admin created this session: **inboxadmin@test.com / Admin1234!** (user_type=admin). Note: `.test` TLD emails are rejected by email validation — use `@test.com` / `@gmail.com` style domains.

## Social login (Google)
- `POST /api/auth/social/google` exchanges an Emergent Google OAuth `session_id` for our JWT. Full Google round-trip needs a real Google account (cannot be automated). Auto-creates the user by email with `auth_provider: "google"`, no password.
- FIXED (Jun 2026): the 401 was caused by a stale global `AuthHandler` in `App.js` that consumed the single-use `session_id` (POSTing to the legacy `/api/auth/session`) before `SocialAuthCallback` (route `/auth/callback`) could call `/api/auth/social/google`. `AuthHandler` was removed. The Google redirect lands on `/auth/callback#session_id=...` → `SocialAuthCallback` exchanges it.

## Mercury Banking (admin, read-only)
- Configured & LIVE with a production token in backend `.env` (`MERCURY_API_TOKEN`). 3 real accounts.
- Admin endpoints: `GET /api/admin/mercury/status`, `GET /api/admin/mercury/accounts`, `GET /api/admin/mercury/reconciliation?days=30` (matches Stripe payouts to Mercury deposits). Admin JWT required.
- Frontend: Admin Panel → "Banking" tab (`AdminMercuryBanking.js`).

## Notes for testing agent
- Customer endpoints requiring auth: `/api/scheduled-orders`, `/api/recurring-orders`, `/api/addresses`, `/api/promo-codes`, `/api/support/*`, `/api/wallet/*`, `/api/referrals/*`.
- Driver-only: `/api/orders/{id}/proof` (POD upload).
- Admin-only: `/api/admin/*`, `/api/service-zones` (POST/PUT/DELETE — GET is public), `/api/whatsapp/send`, `/api/whatsapp/messages`, `/api/whatsapp/conversations`.
- Agent role (`user_type=agent`) also accepted on WhatsApp endpoints.
- Public webhooks (no auth): `/api/webhook/whatsapp`, `/api/webhook/stripe`, `/api/webhook/caripay`.
- Stripe uses test keys; CariPay + Twilio both MOCKED.

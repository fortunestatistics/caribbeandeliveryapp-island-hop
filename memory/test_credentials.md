# IslandHop Test Credentials

## OWNER / SUPER-ADMIN LOGIN (seeded from env on startup)
- **Email:** tracyfortune@islandhoptt.com
- **Password:** IslandHopAdmin2026!  (change via Admin Panel → Team → "Change my password")
- Seeded idempotently from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in backend/.env. Marked `is_owner`.
- Log in at `/login` → Admin Panel at `/admin`.

## Admin (for UI / admin-endpoint testing)
- **Email:** `admin.qa@islandhop-demo.com` / **Password:** `AdminQA1234!` (role admin)

## Orphan-driver repair test user (preview)
- **Email:** `repair_test_driver@islandhop-demo.com` / **Password:** `RepairQA1234!`

## Authentication (UPDATED Jun 2026 — httpOnly cookie migration)
- **JWT Bearer** (primary for NATIVE/mobile + tests): from `/api/auth/register` or `/api/auth/login` → `access_token` (still returned in the response body).
- **WEB now uses an httpOnly cookie**, NOT localStorage. On successful login/register/social/invite the backend sets `session_token` = the JWT as an **httpOnly, Secure, SameSite=Lax** cookie. The web frontend stores only a non-secret sentinel string `'cookie'` in `localStorage.token` (so existing truthiness checks + `Bearer <token>` headers + `?auth=` img URLs keep working — the backend ignores the sentinel and authenticates via the cookie). `logout` clears the cookie.
- Backend accepts **real Bearer token OR the `session_token` cookie**. Placeholder bearer values `{'', 'cookie', 'null', 'undefined', 'none', 'bearer'}` are ignored (`core._clean_token`) so the cookie is used instead.
- For UI auth in browser tests: **log in through the real `/login` form** (which sets the httpOnly cookie) — do NOT inject a JWT into `localStorage.token` (web ignores it; the value there is just the sentinel). For API tests use a cookie jar (`curl -c/-b`) OR a real `Authorization: Bearer <jwt>` header (mobile path).
- Password policy: **min 8 chars**. Public `POST /api/auth/register` ALWAYS creates `user_type=customer`; register field is `name` (not `full_name`); email domains `@test.com`/`@gmail.com` (`.test` rejected); password e.g. `Test1234!`.
- `get_current_user_from_request` accepts the `session_token` cookie OR `Authorization: Bearer <jwt>`.

## Authentication (legacy notes)

## Merchant test accounts (no persisted seed)
- **RESTAURANT:** register customer → `POST /api/restaurants` {user_id:'x',name,description,cuisine_type,address:{street,city,country},phone,email} (promotes user to `user_type=restaurant`, returns restaurant id) → re-login for a JWT with the restaurant role. `_resolve_vendor_for_user` → vendor_type='restaurant'.
- **GROCERY/PHARMACY/RETAIL (businesses collection):** register customer → insert a doc into Mongo `businesses`: {id:<uuid>, user_id:<user id>, business_name, business_type:'grocery'|'pharmacy'|'business', business_description, phone, email, address:{street,city,country}, status:'active', subscription_tier:'standard'} → set that user's `user_type='business'` in `users` → re-login. vendor_type resolves to the business_type.
- **CAR RENTAL:** `car_rental_companies` collection; vendor_type='car_rental'.
- Merchant Settings: `/vendor/settings` (ROLES restaurant|business|admin). Endpoints: `GET/PUT /api/merchant/profile`, `PUT /api/users/me`, `POST /api/auth/change-password`. Products: `/merchant/products` (GET returns `vendor_type`).

## Driver test account
- register customer → `POST /api/drivers` {license_number, vehicle_type, vehicle_plate} (omit banking_info to reproduce null case) → set `user_type='driver'` in Mongo → re-login. `/driver/settings` (ROLES driver|admin). Endpoint: `PUT /api/drivers/profile` (license/vehicle/banking).
- **QA driver (persisted, preview):** `qatest_1784993477@gmail.com` / `Test1234!` — user_type=driver, driver id `qadrv_2978c0f6` (currently offline). Use for driver dashboard / go-online / accept-order UI testing.
- **Broken-driver repair seed (persisted, preview):** `brokendriver_1784996815@gmail.com` / `Test1234!` — had an ACTIVE driver record but `user_type` stuck at `customer` (the exact "approved but no panel" bug). Repaired to `driver` via Admin Account Repair. To re-reproduce the "Needs repair" state, set `users.user_type='customer'` for this account in Mongo.

## Admin Repair tools (Jun 2026)
- **Storefront repair:** `GET /api/admin/merchants/lookup?q=`, `POST /api/admin/merchants/repair-storefront` (component `AdminStorefrontRepair.js`).
- **Account repair (NEW — drivers/customers/merchants):** `GET /api/admin/accounts/lookup?q=` + `POST /api/admin/accounts/repair` {user_id? | driver_id?} (component `AdminAccountRepair.js`, mounted in `AdminApprovals.js`). Heals: promote role for an approved driver/merchant, activate a stuck driver record, create missing driver wallet, unblock paused/restricted accounts. Idempotent. `backfill_approved_drivers()` runs at startup to auto-heal all approved-but-unpromoted drivers.

## Business-type-aware options (Jun 2026)
- Single source of truth: `frontend/src/businessTypeConfig.js` → `getBusinessConfig(type)`.
- Merchant dashboard button `vendor-manage-catalog-btn`; MerchantProducts category dropdown `product-category-select` (+ 'Other…' → `product-category-input`). Customer storefront `/restaurant/{vendor_id}` is now generic/type-aware.

## In-app Wallet (routers/wallet.py + wallet_service.py)
- `/api/wallet`, `/api/wallet/transactions`, `/api/wallet/funding-request(s)`, `/api/wallet/send`, `/api/wallet/requests*`, `/api/wallet/pay-order`; admin funding approve/reject under `/api/admin/wallet/funding-requests`.

## Document uploads (routers/documents.py)
- `POST/GET /api/drivers/documents/{id}/download` and `POST/GET /api/business/documents/{id}/download` (private object storage; supports `?auth=<jwt>` for img/iframe).

## Order-alert test merchant (persisted, preview) — added for merchant new-order alert testing
- **GROCERY merchant "Alert Test Mart":** `merch_1784954600@gmail.com` / `Test1234!` (user_type=business). Has ≥1 pending grocery order. Dashboard at `/vendor-dashboard`. Use to verify the new-order banner/sound + `/api/vendors/my-orders` + `/api/vendors/stats`.

## OTP / Twilio
- Preview backend `MOCK_TWILIO=false` (real Twilio). Merchant new-order alerts now send via **SMS** (`_wa_notify(..., channel="sms")`) — WhatsApp free-form failed delivery with error 63005 for un-opted-in merchants.
- `POST /api/otp/send` / `POST /api/otp/verify`.

## Notes
- Stripe test keys; WiPay sandbox + Twilio MOCKED. Mercury LIVE (read-only). M365 email live in production.

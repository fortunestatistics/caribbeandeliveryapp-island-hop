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

### Jul 6, 2026 — "Needs attention" badge on Approvals tab
- Added an amber count badge on the Approvals tab = pending drivers + merchants(restaurants) + businesses (mirrors the Safety & Disputes badge). Reuses `GET /api/admin/pending-approvals` (fetched on mount). Verified on preview showing "13" (8 drivers + 5 businesses).


### Jul 6, 2026 — Approvals refined into a dedicated new-applications view
- **"Partner Approvals"** header + a **New Applications / All Records** toggle (defaults to New = pending only), so admins process new partners efficiently. Backend `GET /api/admin/records/{category}?status=pending` filters by each category's status field (ignored for `users`). Verified: drivers pending=8 vs all=157; users unaffected.
- Category tabs reordered/relabeled to match partner language: **Driver Applications**, **Merchant Applications** (restaurants), Business Storefronts, Car Rental Companies, User Accounts. Tab count badges reflect the active filter.
- **Integrated with the User Management overhaul:** the User Accounts sub-tab now has inline **Approve / Pause / Restrict** controls (`POST /api/admin/users/{id}/set-status`), matching the Users tab.
- Kept distinct from the Orders tab — order history stays in each record's per-row dialog (noted in the header copy).
- Verified via curl (pending vs all counts) + preview screenshots (toggle, relabeled tabs, 8 driver applications, 57 user-account control rows).


### Jul 6, 2026 — Admin User Management overhaul + unified Safety & Disputes tab
- **Users tab:** added a **User Type filter** (All/Customer/Merchant/Driver; 'merchant' = restaurant+business owners) via `GET /api/admin/users?user_type=`. Per-row **Approve / Pause / Restrict** controls (`POST /api/admin/users/{id}/set-status` with `active|paused|restricted`) + status badge colors (green/amber/red). Full profile dialog access retained.
- **Account-status auth gate:** `_account_block_detail()` blocks **paused/restricted/suspended** accounts at login (403 w/ support message) and on authenticated API access (`get_current_user`, `get_current_user_from_request`). Admin impersonation tokens bypass the gate. Guards: cannot pause/restrict self, owner, or admin/agent accounts (400).
- **Safety & Disputes:** merged the old separate `fraud`/`claims`/`disputes` tabs into ONE `safety` tab labeled "Safety & Disputes" with sub-filter buttons (Frauds/Claims/Disputes) and a combined open-count badge. Agents see the tab but not the Fraud sub-tab. Added a Disputes render block.
- **Security fix:** `/api/admin/users` no longer returns `hashed_password`/`session_token` (scrubbed via projection).
- **Verified:** testing_agent iter 33 — backend 11/11, frontend 100% (filter, status transitions, auth gate paused→403/active→200, self-guard, sub-tab switching). Hash-scrub re-verified via curl.


### Jul 4, 2026 — Admin "Payment Mode" status card + PayPal live creds confirmed
- **New Admin → Overview card** (`AdminPaymentMode.js`) shows at-a-glance whether each rail is LIVE vs TEST/SANDBOX: Stripe (from `sk_live/sk_test`), PayPal (`PAYPAL_MODE`), WiPay (`WIPAY_ENVIRONMENT`), Twilio SMS (`MOCK_TWILIO`). Overall badge = amber "TEST mode — no real money" or green "LIVE — real money"; warns on mixed mode. Backend `GET /api/admin/payment-mode` (admin/agent; env-only, no secrets returned).
- **PayPal creds re-verified: they are LIVE** (existing client_id `AQR9lKfu…` + secret authenticate 200 on api-m.paypal.com, 401 on sandbox). Kept `PAYPAL_MODE=sandbox` for safe preview; flip to `live` + set `PAYPAL_WEBHOOK_ID` to go live. NOTE: no PayPal sandbox creds exist, so PayPal is non-functional in preview until live.
- Verified card renders on preview (all 4 tiles, amber TEST overall badge).


### Jul 4, 2026 — Payments reverted to TEST; live keys parked; go-live scan
- Reverted to TEST/SANDBOX after a live-mode smoke check: `STRIPE_API_KEY=sk_test`, `PAYPAL_MODE=sandbox`, WiPay sandbox. LIVE Stripe keys PARKED (unused by code) as `STRIPE_LIVE_API_KEY`/`STRIPE_LIVE_PUBLISHABLE_KEY` (backend) + `REACT_APP_STRIPE_LIVE_PUBLISHABLE_KEY` (frontend). Switch steps in `/app/memory/GO_LIVE.md`.
- Fixed pre-existing bug: `PaymentMethodsSelector.js` read a non-existent `REACT_APP_STRIPE_API_KEY` and fell back to a hardcoded test key from a DIFFERENT Stripe account → now uses `REACT_APP_STRIPE_PUBLISHABLE_KEY`.
- deployment_agent: fixed 3 unbounded queries (`/orders/{id}/substitutions` .limit(200), `/service-zones` + `/service-zones/check` .limit(500)) and removed `.env`/`.env.*`/`*.env` from `.gitignore`. Final scan = **PASS, 0 blockers**.


### Jul 4, 2026 — Admin "Approvals" comprehensive records section
- **Replaced the old pending-only Approvals tab** with a full records browser (`AdminApprovals.js`, rendered for the `approvals` tab in `AdminPanel.js`). Five category sub-tabs: **Restaurants, Drivers, Car Rental Companies, Business Storefronts, User Accounts** — each shows ALL records (any status) with a status badge + contact line, an expandable **full submitted-data grid** (every field, nested objects rendered as JSON), and per-record actions.
- **Order History:** each record has an **Orders** button → dialog loading `GET /api/admin/records/{category}/{id}/orders` (returns `type:order` for restaurants/drivers/businesses/users, `type:rental` for car_rentals via `rental_bookings`).
- **Approve/Reject** inline for pending drivers/restaurants/car_rentals/businesses (reuses existing endpoints); **View portal** (impersonate) button when the record has a `user_id`. User Accounts have no approve/reject.
- **Backend:** `GET /api/admin/records/{category}?q=&limit=` (admin/agent, 403 otherwise) returns `{count, records:[{summary…, full}]}`; sensitive user fields (`hashed_password`, `password`, `session_token`) scrubbed. `_RECORD_CATEGORIES` maps category→collection→status field.
- **Verified:** testing_agent iter 32 — backend 14/14, frontend 100% (all 5 sub-tabs load live data, expand grid, order-history dialog, users hide sensitive fields + no approve/reject). Added `DialogDescription` for a11y.
- **Backlog flagged by review:** split `server.py` (~10.5k lines) into routers; per-category allowlist (vs denylist) for record fields; virtualize/paginate the driver list (157+ rows).


### Jul 4, 2026 — Promote & Earn: rewards escrowed until referred partner's FIRST ORDER
- **New behavior:** Driver / Business-Merchant / Supplier referral rewards are NO LONGER paid at approval. `_award_promo_reward(..., require_first_order=True)` now creates the reward in a **`pending_first_order`** state (no wallet credit). It is released only when the referred entity completes their **first order** (order reaches `delivered`).
- **Settlement:** new `_settle_partner_first_order_rewards(order)` runs (fire-and-forget) in `update_order_status` on `delivered`. It resolves the order's vendor (`restaurants`/`business_applications`/`car_rental_companies` → `user_id`) and driver (`drivers` → `user_id`), then transitions their promoter's `pending_first_order` reward → **`paid`** (credits wallet, sets `first_order_at`) if the promoter is eligible, else **`held`** (existing hold-until-eligible path via `_release_held_promo_rewards`). Idempotent (only transitions `pending_first_order`).
- **Tracking:** every promo_reward now stores `referred_entity_type`, `signup_date`, `first_order_at`, `paid_at`, `status`. Customer rewards (first paid order) unchanged.
- **New admin endpoint:** `GET /api/admin/promo-rewards?status=` (admin/agent) → per-reward ledger + `counts{pending_first_order,held,paid}` + reward schedule.
- **UI (Admin → Promoters tab, `AdminPromoters.js`):** 3 status summary cards (Pending First Order / Ready for Payout / Paid Out) + a **Referral Rewards** table (promoter, referred entity, type, signed-up date, first-order date, amount, status badge). Statuses map: `pending_first_order`→"Pending First Order" (amber), `held`→"Ready for Payout" (blue), `paid`→"Paid" (green). Original promoters/ambassadors table retained below.
- **Verified:** functional test `backend/tests/test_first_order_reward.py` — reward created `pending_first_order` (wallet NOT credited), then on delivered order → `paid` + wallet credited $15 + `first_order_at` set + idempotent (1 txn). UI confirmed rendering on preview.


### Jul 3, 2026 — Twilio A2P SMS consent compliance
- **Signup opt-in checkbox** added to `AuthPage.js` (signup mode): unchecked by default (optional), with the exact required legal language — "By checking this box, I agree to receive automated transactional SMS notifications from IslandHop Technologies LLC…STOP…HELP…" — and clickable **Privacy Policy (/privacy-policy)** + **Terms (/terms-and-conditions)** links. `sms_consent` boolean passed in the register payload. testids: `sms-consent-checkbox`, `sms-consent-text`, `sms-consent-block`.
- **Policy pages verified live/accessible:** `/privacy-policy` (PrivacyPolicy.js) and `/terms-and-conditions` (Terms.js) both render full content; `/terms` also maps to Terms. Privacy Policy explicitly discloses SMS/WhatsApp transactional notifications.
- Verified on preview via screenshots. NOTE: server-side persistence of consent (audit trail) NOT added (would require an auth-model change) — deferred; not required for campaign approval which reviews the signup opt-in UI + language + policy pages.

### Jul 3, 2026 — Deployment readiness (PASS)
- Ran deployment_agent health check. Fixed all flagged unbounded queries: converted `_recompute_entity_avg_rating` to a `$avg/$sum` aggregation, and added explicit `.limit()` safety caps to 6 date/ID-scoped queries (payouts batch 10000, ticket messages 1000, day analytics 10000, driver orders 5000, driver ratings 5000, held promo rewards 1000). Final status: **PASS — no deployment blockers** (env-var usage, CORS, ports, secrets, supervisor, auth redirects all green).
- READY TO REDEPLOY. This redeploy carries the accumulated preview work: checkout fix, email routing (support@/drivers@/partners@/investors@, "IslandHop Support" sender), merchant re-pricing (Standard 20% / Professional TT$800 15% / Premium TT$1600 5%), subscriber-priority + exclusive-window dispatch, Android project download endpoint, admin test-data Cleanup tool, and SEO files.

### Jul 3, 2026 — Admin test-data cleanup tool + seed gating
- **New admin-only cleanup tool** (soft-launch): Admin dashboard → **Cleanup** tab (`AdminDataCleanup.js`). Shows a DRY-RUN preview of exactly what will be removed (per-collection counts + names), then a typed-confirm ("DELETE") to purge. Endpoints: `GET /api/admin/cleanup/preview`, `POST /api/admin/cleanup/execute` (requires `{"confirm":"DELETE"}`, admin-only).
- **Rules:** deletes seeded sample restaurants (Island Spice Kitchen, Tropical Grill, Beach Bites Cafe) + any test-pattern restaurants/drivers/applications/users/orders (regex: test, sub/slice/chat pizza, e2e, qa, demo, 8+ digit timestamps, @example.com, etc.) and cascades orders/wallets/subscriptions. **KEEPS** "Caribbean Spice Kitchen" + all real applicants; NEVER deletes admin/staff/owner accounts or the requesting admin.
- **Seed gated:** sample-restaurant seeding now requires `SEED_SAMPLE_DATA=true` (default false) so test restaurants never reappear on production after a redeploy.
- VERIFIED on preview: dry-run flagged 434 records; execute deleted 434, leaving ONLY "Caribbean Spice Kitchen"; admin still logs in; execute without confirm → 400. (Running it validated the tool AND cleaned the preview sandbox.)
- NOTE: production has a SEPARATE database — Tracy must click the Cleanup button on the LIVE site after redeploy; cleaning preview does not affect production.

### Jul 3, 2026 — Subscriber-EXCLUSIVE first-dibs dispatch window
- On top of the priority scoring, dispatch is now **two-phase**: Phase 1 offers the job EXCLUSIVELY to nearby Pro/Premium subscribers (top 3); if none accept within `DRIVER_PRIORITY_WINDOW_SECONDS` (default **30s**, set in backend/.env), `_priority_second_wave` opens it to all remaining (Standard) drivers. If NO subscribers are online, it opens to everyone immediately. If a subscriber accepts during the window, it NEVER opens to Standard (guarded on `driver_id`).
- VERIFIED on preview (window=5s test): Phase 1 notified only [premium, pro]; after window, Standard added; and when Premium accepted first, Standard was never notified (`opened_to_all` stayed null). Restored window to 30s.

### Jul 2, 2026 — Subscriber-priority taxi/delivery dispatch
- **Dispatch now gives subscribers first preference.** Previously `find_and_assign_driver` scored online drivers within 10km purely by proximity+rating (`rating*10 - distance_km`) and pinged the top 3 (WebSocket + WhatsApp), first-to-accept wins — subscription tier had NO dispatch effect. Added `_score_drivers_with_priority()` applying `DRIVER_DISPATCH_PRIORITY_BONUS = {premium:1000, pro:500, standard:0}` so ordering is Premium > Pro > Standard, with proximity/rating deciding within a tier. Standard drivers are still notified if slots remain (soft, non-exclusive). Tier resolved via existing `_driver_plan_tier`.
- VERIFIED (simulated dispatch): with Standard closest (0.16km) and Premium farthest (3.14km), offer order was Premium → Pro → Standard. Backend-only; no frontend change.

### Jul 2, 2026 — Merchant plan re-pricing (Standard 20% / Professional TT$800 15%) + Android project download
- **Merchant commission update (single source of truth = `MERCHANT_SUBSCRIPTION_PLANS` in server.py):** Standard → FREE / **20%** (now flat across all vendor types, was per-type 8–15%), Pro renamed **"Professional"** (internal tier key kept as `"pro"` to avoid breaking existing subscriptions/subscribe endpoint) → TT$800 / **15%** (was 10%), Premium unchanged (TT$1600 / 5% — KEPT per non-destructive default; Tracy's answer on removal was ambiguous). `MERCHANT_PLAN_COMMISSION = {standard:20, pro:15, premium:5}`; `_merchant_commission_rate` now returns flat tier rate. Flat $3.00 customer service fee (100% platform) unchanged.
- **UI/text sync:** `MerchantSubscription.js` is backend-driven (auto-updated). `/business/pricing-tiers` now DERIVES from the catalogue (was stale DB seed: Starter/Professional/Enterprise USD) so BusinessOnboarding shows correct tiers. Public `/pricing` page (`SubscriptionPlans.js`) businessPlans rewritten to Standard(free/20%)/Professional(TT$800/15%)/Premium(TT$1600/5%). `RestaurantOnboarding.js` payout note updated 15%→20%.
- **Math VERIFIED via API orders** (subtotal $100): Standard → commission $20 / payout $80 / fee $3; Professional → commission $15 / payout $85 / fee $3.
- **Android project download:** `npx cap sync` + zipped `/app/backend/static/android-project.zip` (50MB, build artifacts excluded) + public endpoint `GET /api/download/android-project` (FileResponse, attachment `islandhop-android-project.zip`). Verified on preview (200, correct headers, valid zip). NOTE: endpoint is PUBLIC (no auth) as requested.

### Jul 1, 2026 — Email routing to 4 mailboxes + sender identity + merchant price fix + wallet checkout
- **Email sender identity:** all outgoing Graph emails now set `from.emailAddress.name` = **"IslandHop Support"** (env `MAIL_SENDER_NAME`, default). `graph_mail.send_mail` updated.
- **Category-based mailbox routing** (`graph_mail.notify_mailbox(category)`): support→`support@islandhoptt.com`, driver→`drivers@islandhoptt.com`, investor→`investors@islandhoptt.com`, merchant/partner→`partners@islandhoptt.com` (env-overridable: SUPPORT_/DRIVER_/INVESTOR_/MERCHANT_NOTIFY_MAILBOX). Send-sites routed: new driver apps + KYC decisions → drivers@; new merchant/partner apps → partners@ (was mis-set to `partner@`); support tickets (new: alert+ack) & admin→user messages & team invites → support@. Investor inquiries are `mailto:investors@` links (Footer/AboutPage) — already correct, no backend form. `default_sender_mailbox()` now prefers support@ (was drivers@).
- **WhatsApp app alerts** now state which mailbox handled the email ("📧 Email routed to <mailbox>").
- **In-app onboarding emails (fixed earlier this session):** `POST /business/onboarding` and `POST /drivers` now fire `_notify_new_application` (were silent). Verified on preview: merchant/support/driver sends all succeed with no Graph errors (proves send-as works for all 4 tenant mailboxes with existing Mail.Send).
- **Merchant/Driver subscription prices not showing (FIXED):** root cause = `load()` used `Promise.all([publicPlans, currentSubscription])`; the authed `/merchant/subscription` (or `/driver/subscription`) returns 404 for non-merchants/non-drivers (e.g. admin/owner) or 401 logged-out, which rejected the whole Promise → `plans` stayed `[]` → NO prices rendered. Decoupled both `MerchantSubscription.js` & `DriverSubscription.js`: plans load from the PUBLIC endpoint independently; current-tier is best-effort and never blocks rendering. Public `/merchant/subscription/plans` returns Pro TT$800 / Premium TT$1600 (curl-verified).
- **Wallet at checkout (was missing UI):** `/api/wallet/pay-order` worked but had NO button. Added "Pay with IslandHop Wallet (Balance: …)" button to `CheckoutPage.js` (fetches `/wallet`, disabled + "Add funds" link when balance < total) and `via=wallet` handling in `PaymentSuccess`. Full wallet flow curl-verified: deposit request → admin approve → balance $100 → pay order → debited to $67.

MANUAL (Tracy): WhatsApp *sender display name* is NOT per-message — set it in Meta Business Manager / Twilio WhatsApp Sender profile to "IslandHop Support". To also READ/auto-reply from the 4 mailboxes, add them to `SUPPORT_MAILBOXES`. Redeploy to push all of the above (incl. earlier checkout fix + SEO) to production.


### Jun 30, 2026 — P0 FIX: Checkout flow + SEO improvements
- **P0 CHECKOUT BUG FIXED & VERIFIED.** Root cause: Restaurant/Grocery/Courier/Pharmacy order forms called `navigate('/checkout', {state})` but only `/checkout/:orderId` exists → users bounced to landing, could not pay. Fix: new shared helper `frontend/src/orderApi.js` (`isLoggedIn`, `fetchProfile`, `formatProfileAddress`, `createOrder`). All 4 forms now: gate on login (→`/login`), build a proper `Order` payload (items mapped to `{menu_item_id,name,quantity,price}`), `POST /api/orders`, then `navigate('/checkout/'+id)` — mirroring the working TaxiBookingForm.
  - Delivery address: uses the user's saved profile address (fallback) or the form's typed address; RestaurantMenu got a new address input (`restaurant-delivery-address-input`) prefilled from profile. Phone pulled from profile.
  - New testids: `restaurant-checkout-btn`, `restaurant-delivery-address-input`; grocery: `grocery-store-card-{id}`, `grocery-add-btn-{id}`, `grocery-delivery-address-input`, `grocery-checkout-btn`.
  - VERIFIED: testing_agent iter 31 — Restaurant full browser E2E PASSED (add items → address → /checkout/{id} → COD → "Order placed!"), backend 5/5 pytest, negative cases (logged-out→/login, empty address→alert) passed. Grocery verified via API e2e (order create → confirm-cod 200 → cod_pending) + identical code path.
- **SEO fixes** (visible after production redeploy): added static `public/robots.txt` (plain text + Sitemap directive), `public/sitemap.xml` (11 URLs), proper `public/llms.txt`; added `alt="Made with Emergent"` to badge img in `index.html`; changed header brand in `SubAppsDropdown.js` from `<h1>` to `<span>` to fix the site-wide multiple-H1 issue. Audited domain was `islandhopapp.com` (NOTE: `index.html` canonical/OG still point to `www.islandhoptt.com` — domain inconsistency flagged to user).
- Feature status confirmed present on preview: 3-tier Driver subs (Standard/Pro TT$700/Premium TT$1400, route `/driver/subscription`, linked from DriverDashboard), 3-tier Merchant subs (Standard/Pro TT$800/Premium TT$1600, route `/merchant/subscription`, linked from VendorDashboard), Merchant Storefront Builder (`/merchant/storefront`), Self-Service Coupons (`/merchant/coupons` + checkout `apply-promo`), Featured Partner flag (backend pins Pro/Premium first in `/api/restaurants`).


### Jun 27, 2026 — GitHub Actions: auto-build signed Android .aab
- Added `.github/workflows/android-build.yml`: on push to main/master (or manual `workflow_dispatch`), an **x86_64 ubuntu runner** builds web → `npx cap sync android` → `./gradlew bundleRelease`, producing a **signed `.aab`** (uses the in-repo keystore) uploaded as the `islandhop-release-aab` artifact. Solves the arm64/aapt2 limitation of the dev container.
- Fixed a blocking bug: `android/gradle/wrapper/gradle-wrapper.properties` pointed `distributionUrl` to a local `file:///tmp/gradle-8.11.1-bin.zip` (would fail on CI **and** in Android Studio) → changed to the public `https://services.gradle.org/...` URL. Android download zip refreshed with the fix.
- Production backend for the released app is set via workflow env `REACT_APP_BACKEND_URL` (default `https://islandhopapp.com`, override with a repo variable).



### Jun 27, 2026 — Featured Partner ranking + paid Merchant Ad space + signed Android project
- **Featured ranking:** `GET /api/restaurants` now returns `featured` + `subscription_tier` and pins Pro/Premium (Featured) merchants to the top (then by rating). Restaurant model extended. The public `/restaurants` page now **fetches real data** (was hardcoded) and shows a gold "Featured" badge on featured merchants. Featured flag is set when a merchant selects a Pro/Premium subscription.
- **Merchant Ad space (paid):** new `merchant_ads` collection + `AD_PACKAGES` (Homepage 7d TT$300, Homepage 30d TT$1000, Website 30d TT$1500). Endpoints: `GET /api/ads/packages`, `GET /api/ads/active?placement=`, `POST /api/ads/{id}/click`, `GET/POST /api/merchant/ads`, `PATCH/DELETE /api/merchant/ads/{id}`. UI: `MerchantAds.js` (/merchant/ads, "Advertise" button on vendor dashboard) to buy ad space (sandbox payment); landing page renders a "Sponsored Partners" section (`SponsoredAds.js`) with live homepage ads + click tracking. Verified iter 30: backend 8/8, frontend 100%.
- **Android (.aab):** could NOT compile in this cloud container (arm64/aarch64 — Android's `aapt2` ships x86_64-only and binfmt emulation is blocked by container security). Instead baked a release signing key into the project (`android/keystore/islandhop-upload.jks`, store/key pass `islandhop2026`, alias `islandhop`) + `SIGNING_README.md`, so Android Studio produces a **signed** `.aab` in one click. Download: https://logistics-island.preview.emergentagent.com/islandhop-android.zip
- NOTE: subscription + ad payments are SANDBOX-activated (no live recurring charge wired yet).



### Jun 27, 2026 — 3-tier Driver & Merchant subscriptions + Android project export
- **Driver tiers** (prices TTD): Standard Free→keep 80% (20% cut), Pro TT$700/mo→keep 90% (10% cut), Premium TT$1,400/mo→keep 100% (0% cut). Tips always 100%. Backend: `DRIVER_PLAN_RATES`, `_driver_plan_tier`, `_driver_delivery_fee_rate`; endpoints `GET /api/driver/subscription/plans|/subscription`, `POST /api/driver/subscription/select`. Tier mirrored on driver profile doc (`subscription_tier`). UI: `DriverSubscription.js` (/driver/subscription) + dashboard button; earnings dashboard shows 3 tier cards + examples (Std $14.60 / Pro $15.80 / Prem $17.00). Verified: payout math Std 21 / Pro 23 / Prem 25.
- **Merchant tiers** (prices TTD): Standard Free→15% commission, Pro TT$800/mo→10% + Featured Partner, Premium TT$1,600/mo→5% + Premium Marketing + Priority Support. Backend: `MERCHANT_SUBSCRIPTION_PLANS`, `_merchant_plan_tier`, `_merchant_commission_rate` (now used by `calculate_order_financials` — fixed an old bug where the vendor-subscription lookup keyed on the wrong id and never matched); endpoints `GET/POST /api/merchant/subscription[/plans|/select]`. `featured` flag scaffolded on the merchant profile doc for future search ranking. UI: `MerchantSubscription.js` (/merchant/subscription) + dashboard button; Become-a-Partner page shows tier cards. Verified: commission 15%/10%/5%, vendor_payout 85/90/95, **$3 service fee unchanged & 100% platform**.
- **Android (Capacitor) export:** package `com.islandhop.app` confirmed (capacitor.config.json + android/app/build.gradle); ran `npx cap sync android`; produced downloadable project zip at `/app/frontend/public/islandhop-android.zip` → https://logistics-island.preview.emergentagent.com/islandhop-android.zip (open in Android Studio → Generate Signed Bundle). No JDK/SDK in container so .aab not built here.
- Verified iter 29: backend 7/7, frontend 100% (zero functional issues).



### Jun 27, 2026 — Admin click-to-review dialogs + Subscription links everywhere + bugfix
- **Approvals:** applicant detail dialog now shows the KYC status + a "Submitted documents" section with buttons that open each uploaded file (`/api/drivers/documents/{id}/download`) or a "no documents" warning. (`AdminPanel.js` `applicant-detail-dialog`.)
- **Claims:** claim rows are now clickable → `claim-detail-dialog` (full description, enlargeable proof photo, Approve&credit / Reject). Inline row buttons keep working via `stopPropagation`.
- **Fraud:** flag rows clickable → `fraud-detail-dialog` (severity, order summary, customer, all signals, Clear / Confirm Fraud). Inline buttons preserved.
- **Subscription links in ALL portals → /pricing:** Admin header (`admin-subscription-link`), Driver header (`driver-subscription-link`), Vendor header (`vendor-subscription-link`); customers already have the global header "Pricing" link.
- **Bugfix:** `GET /api/business/onboarding` (and `/{application_id}`) called the wrong auth helper `get_current_user(request)` → always 500 (`'Request' object has no attribute 'credentials'`). Switched to `get_current_user_from_request`; now 401 unauth / 200 authed. Also added the missing auth header to App.js `fetchApplications` so the customer's business-application status view loads. Verified via curl.
- Verified iter 28: frontend 5/5; admin review dialogs + subscription links all pass.



### Jun 27, 2026 — Tiered driver payout (Premium 100% / Standard 80%)
- New 2-tier delivery-fee split: **Premium** (active `user_subscriptions` row OR driver-profile `is_premium=true`/`subscription_status` in premium|active|subscribed) keeps **100%** of delivery fees; **Standard** keeps **80%** (20% platform cut). Tips always 100% to driver. Flat **$3.00** customer service fee stays 100% platform in BOTH tiers.
- Backend (`server.py`): `DRIVER_FEE_RATE_SUBSCRIBER` default **0.10→0.00**; new `_driver_is_premium(driver_doc)`; `_driver_delivery_fee_rate(user_id, driver_doc)` now honours the profile premium flag; `_finalize_driver_split` passes the driver doc. Verified math: standard (del $20/tip $5) → driver $21, platform $14.50; premium → driver $25, platform $10.50.
- Frontend copy updated to TWO tiers: `DriverEarningsDashboard.js` (tier cards `tier-premium`/`tier-standard`, example Premium $17 / Standard $14.60), `DriverOnboarding.js` badges, `App.js` partner-rate-highlight. (Supersedes the earlier "flat 100%" copy.)

### Jun 27, 2026 — Merchant Storefront Builder + Self-Service Coupons
- **Storefront:** new `merchant_storefronts` collection. Merchant edits logo/cover/bio(≤500)/gallery(≤6, base64 via `imageUtils.fileToResizedDataURL`). Endpoints `GET/PUT /api/merchant/storefront` (auth, resolves vendor via `_resolve_vendor_for_user`) + public `GET /api/merchants/{vendor_id}/storefront`. UI: `MerchantStorefrontEditor.js` (`/merchant/storefront`); public hero rendered atop `RestaurantMenu.js` (`storefront-hero`). Nav button on VendorDashboard.
- **Coupons:** new `merchant_coupons` + `merchant_coupon_usage` collections. Merchant CRUD: `POST/GET /api/merchant/coupons`, `PATCH /api/merchant/coupons/{id}` (toggle active), `DELETE`. Code auto-gen, percentage|fixed, min order, expiry, usage limit, unique per merchant. UI: `MerchantCoupons.js` (`/merchant/coupons`).
- **Checkout redemption:** `apply_promo_to_order` now falls back to `_apply_merchant_coupon` (validates merchant scope, active, expiry, usage limit, min order; discount applied to subtotal BEFORE the $3 service fee; idempotent per order via usage doc). Checkout promo input relabelled "Have a promo or coupon?". Verified: 15% on $50 → $7.50 discount, total $55.50.
- **Perf (same session):** React.lazy route code-splitting (initial JS 327KB→177KB gzipped), 97 MongoDB indexes across 46 collections on startup, removed unused `firebase` dep, capped admin profile order scan. Verified iter 26.
- Verified iter 27: backend 15/15, frontend 100%, zero issues.


### Jun 23, 2026 — Admin customer profile + COD cash reconciliation
- **Admin → Users customer profile:** clicking a user row (or the eye button) opens a full profile dialog — contact, status, address, member-since, user ID, order stats (count / total spent / delivered / active) and the 5 most recent orders, plus an Email action. New endpoint `GET /api/admin/users/{id}/profile` (admin-only). Row action buttons stopPropagation so they don't open the profile.
- **COD cash reconciliation:** drivers delivering a Cash-on-Delivery order tap **"Delivered — Collect $X cash"** (ActiveOrderCard, shows a `COD · collect $X` badge). This marks the order delivered + `POST /api/orders/{id}/cash-collected` → `payment_status=cod_collected`, and tracks the cash the driver owes the platform (`platform_due = total − driver_earnings`) on the driver record (`cash_outstanding`). Admins see a **"Driver Cash Outstanding"** card in the Orders tab (`GET /api/admin/drivers/cash-outstanding`) and can **Mark settled** (`POST /api/admin/drivers/{id}/settle-cash`, writes a `driver_cash_settlements` audit row).
- **Verified:** testing_agent iter 25 — backend 10/10 (RBAC, math, idempotency, 404s); frontend ~95% (all primary flows; the one miss was data-drift on the placeholder demo user, since re-seeded). Cash math example: total $53 − driver_keeps $8 = $45 platform_due.


### Jun 23, 2026 — CariPay removal + digital wallet hidden + COD checkout
- **CariPay removed completely:** deleted `caripay_client.py`, removed all CariPay endpoints (`/wallet/link`, `/wallet/deposit`, `/wallet/withdraw`, `/webhook/caripay`), the `import caripay_client`, the `CARIPAY_*`/`MOCK_CARIPAY` env vars, and the `caripay_*` fields on the Wallet model. No CariPay reference remains in backend or frontend.
- **Digital wallet hidden from users:** deleted `WalletPage.js` + `WalletFunding.js`, removed the `/wallet` nav link, `/wallet` route now redirects to `/dashboard`. No top-up / balance / wallet-pay UI anywhere. (Internal `_credit_wallet_with_txn` payout plumbing for driver earnings/referrals is retained but not user-facing.)
- **Checkout pivoted to COD:** `POST /api/orders/{id}/confirm-cod` confirms an order with `payment_method=cash`, `payment_status=cod_pending`, `status=confirmed`, best-effort driver assignment, and a WhatsApp 'confirmed' notification. Checkout now offers ONLY **Cash on Delivery (primary)** + **WiPay (secondary, sandbox: API Key 123 / Account 1234567890)**. Stripe card button + the Stripe/Apple/Google-Pay footer removed. PaymentSuccess shows a COD 'Order placed!' screen.
- **CRITICAL pre-existing bug fixed:** `PUT /api/orders/{id}/status` had its route decorator attached to a helper (`_status_timestamp_field`) instead of `update_order_status`, so status updates silently no-opped. Moved the decorator to the real handler and allowed `admin`/`agent` roles to update status. Verified full flow: confirmed → preparing → picked_up → delivered. This unblocks the whole logistics test loop.
- **Verified:** testing_agent iter 24 (frontend 100%, backend 12/13 — the 1 failure was this decorator bug, now fixed & re-verified by direct test). Mail status, Privacy/Terms, WhatsApp code path intact.
- **NOTE:** `Terms.js` still has one sentence mentioning "The IslandHop Wallet" — left unchanged per the explicit "do not change Privacy/Terms" instruction; flag for the user to update later.


### Jun 23, 2026 — Taxi fare engine (real distance + time)
- **How delivery fees work (clarified):** delivery fee is a **flat rate each vendor sets** at onboarding — there is no distance engine for deliveries. Taxi, by contrast, now has a real metered fare.
- **Backend (`taxi_pricing.py` + endpoints):** rate card in TT$ (Economy TT$16+1.70/km, Standard/Premium TT$22+2.15/km, Van TT$42+2.00/km; per-min, min-fare floor, higher per-km beyond 20km). `GET /api/taxi/rate-card` (public) and `POST /api/taxi/quote` compute fare from **real driving distance + time via Google Directions API** (Distance Matrix/Geocode are disabled on this key; Directions works). Fares are computed in TT$ then converted to USD for storage (app stores USD, displays TT$ ×6.78).
- **Anti-tamper:** `create_order` recomputes the taxi fare server-side from pickup/drop-off coords and overrides any client-sent `delivery_fee`. Verified: client sent 999 → backend stored real $16.57.
- **Driver economics:** taxi fare flows through the same payout rules — driver keeps fare minus the 10% (subscriber) / 20% (non-subscriber) cut + 100% of tips; $3 service fee + the platform cut go to the platform. (commission = 0 since no merchant subtotal.)
- **Frontend (`TaxiBookingForm.js`):** rewritten with Google Places **autocomplete** for pickup/drop-off, live fare quote (distance + ETA), currency-accurate rate labels, and real **order creation → `/checkout/:orderId`** (was previously a mock that navigated to a broken `/checkout`). Requires login to book (redirects to /login).
- **Order model:** added optional `notes`.
- **Verified:** quote math exact (PoS→Chaguanas 24km Standard = TT$112.32/$16.57; Van 44km = TT$279.82/$41.27); full taxi order creation with correct split; UI renders with exact TT$ rate labels. NOT yet automated end-to-end through Google Places autocomplete (recommend a quick manual booking test).


### Jun 23, 2026 — New approved fee/payout structure
- **Merchant commission:** 15% of item subtotal (restaurant default; other vendor types keep their existing defaults).
- **Customer Service Fee:** flat **$3.00** added to checkout total, **100% to platform** (env-overridable `PLATFORM_SERVICE_FEE`). Shown on the Customer Receipt (`checkout-service-fee`).
- **Delivery fee + tips → driver**, minus platform's delivery-fee cut: **10% for paying driver-subscribers, 20% for non-paying drivers** (`DRIVER_FEE_RATE_SUBSCRIBER`/`DRIVER_FEE_RATE_NONSUBSCRIBER`). **Tips are always 100% to the driver.** Drivers also keep monthly incentive payouts.
- **Implementation:** `calculate_order_financials()` sets commission + $3 service fee + delivery split (defaults to non-subscriber 20% since driver unknown at creation) and recomputes `total` to include the service fee. New `_finalize_driver_split()` re-splits the delivery fee at the moment a driver is assigned (auto-assign in `/orders/create` + `/orders/{id}/accept-driver`) based on that driver's active subscription. `_recompute_order_total()` now includes `service_fee` (tip/promo edits stay correct). Order model gained `service_fee` + `driver_fee_rate`. Analytics now use stored `driver_earnings`.
- **Verified math (test orders on preview):** subtotal $100 / delivery $20 / tip $5 → commission $15, vendor payout $85, service fee $3, total **$128**. Non-subscriber driver: keeps $16 delivery + $5 tip = **$21**, platform **$22**. Subscriber driver (10%): keeps $18 + $5 = **$23**, platform **$20**.
- **UI:** Driver Onboarding (`driver-rate-highlight`) and Become-a-Partner (`partner-rate-highlight`) now advertise the competitive rates (15% commission; drivers keep up to 90% of delivery fees + 100% of tips + monthly bonuses).


### Jun 23, 2026 — WhatsApp inbound webhook dedup/consolidation
- **Audit finding:** Our backend sends NO welcome WhatsApp message anywhere (no welcome logic in code, zero "welcome" outbound rows in `whatsapp_messages`, and the send path creates exactly one message per call). The duplicate welcome Tracy received is generated by **Twilio-side config** (Studio Flow / WhatsApp sender auto-reply), not our code.
- **Code hardening:** Consolidated the two inbound endpoints — `POST /webhook/whatsapp` (legacy) now delegates to the canonical `POST /webhooks/whatsapp`. Added **MessageSid idempotency**: a duplicate delivery of the same inbound message is ignored (verified: 3 deliveries → 1 row). Removes the double-registration/divergent-logic risk on our side.
- **ACTION REQUIRED (Twilio Console, not code):** To stop the duplicate welcome, point the WhatsApp sender's inbound webhook to a SINGLE URL (`/api/webhooks/whatsapp`) and ensure the welcome auto-reply (Studio Flow / Conversations autoresponder) is attached in only ONE place (either the number OR the Messaging Service, not both).


### Jun 23, 2026 — P0 fix: Admin "Message Customer" placeholder-email bug + admin detail modals
- **Root cause:** Admin → Users "Message Customer" was emailing system/QA placeholder addresses (e.g. `id_start_..._...@gmail.com`, `*@test.com`) left behind by the backend test suite (`tests/test_identity_kyc.py`, `conftest.py`), causing bounces. No recipient validation existed before Microsoft Graph `sendMail`.
- **Fix (backend):** `graph_mail.is_real_email()` rejects placeholder local-prefixes (`id_start_`, `id_noapp_`, `id_session_`, `id_kyc_`, `sched_test_`, `resto_test_`, `driver_test_`, `qa_test_`) + placeholder domains (`test.com`, `example.*`, `test.test`) + syntactic non-emails. Guard added inside `send_mail()` (raises `InvalidRecipientEmail`) AND at new endpoint `POST /api/admin/users/{user_id}/message` (returns 400/403/404). Defense in depth.
- **Fix (DB):** `scripts/cleanup_test_users.py` deleted ~1788 placeholder/test users. `conftest.py` now has a session-scoped autouse teardown that purges test-pattern users after each run so they never leak into prod/preview again.
- **Fix (frontend, AdminPanel.js):** Users tab shows amber "No valid email" badge + disabled message button for placeholder users (uses authoritative backend `email_is_real` flag). New email-compose dialog (`message-user-dialog`).
- **New feature:** Admin → Orders cards are clickable → `order-detail-dialog` (service, customer, items, transaction breakdown subtotal/fee/tip/tax/discount/total, payouts & earnings). Admin → Approvals rows have a "View" button → `applicant-detail-dialog` (type/email/phone/applied + linked customer account + application details, with Approve/Reject).
- **Backend improvement:** `GET /api/admin/users` now honours `?q=` (case-insensitive regex on name/email/phone), sorts by `created_at` desc, limit up to 2000, and returns derived `email_is_real` per user. Users-tab search box now does debounced server-side search.
- **Tested:** testing_agent iteration_23 — backend 7/7 guard tests pass, all 3 dialogs render with testids. Self-verified search + badge + disabled button on preview.
- **Admin test account:** `admin.qa@islandhop-demo.com` / `AdminQA1234!` (see test_credentials.md).


### Jun 22, 2026 — Meta App Secret + webhook signature verification + 5 WhatsApp templates
- Added `META_APP_SECRET` and `META_APP_ID=2180974786018435` to backend/.env.
- Re-created + submitted 5 WhatsApp templates via Twilio Content API (twilio/text, en, with {{n}} vars), all status=received: driver_welcome HX5b8d8946381d2c4b602d95e8cf8b5efa (MKT), merchant_welcome HXca1f02f37f64791bb1fe071517db5c83 (MKT), order_update HXb5b4f7aef8a67074fde372c65d57309b (UTIL), delivery_assigned HX2bd3767066c14a25dd297f7f9c8e92f0 (UTIL), pickup_ready HXfbda51c375e45b319b5ec171c7f3de0d (UTIL).
- `/api/webhooks/whatsapp` upgraded: now verifies Meta `X-Hub-Signature-256` (HMAC-SHA256 w/ META_APP_SECRET) → 403 on mismatch; parses BOTH Twilio form + Meta Cloud API JSON; logs signature_verified. Added GET `/api/webhooks/whatsapp` Meta verification handshake (echoes hub.challenge if hub.verify_token == META_WEBHOOK_VERIFY_TOKEN env). Backward-compatible: no-signature (Twilio) requests still 200.
- Verified preview: no-sig→200 TwiML, invalid Meta sig→403, valid Meta sig→200. Production no-sig→200 (old handler; needs redeploy for sig-verify + Meta parsing + META envs).


### Jun 22, 2026 — Debug APK built + Capacitor finalized + D-U-N-S
- D-U-N-S 145048519 added to backend/.env (`DUNS_NUMBER`) and documented in `/app/PLAY_STORE_NOTES.md` (App ID com.islandhop.app, versionCode 1, versionName 1.0, build/sign commands, Play Console links).
- AndroidManifest: added INTERNET, ACCESS_NETWORK_STATE, ACCESS_FINE/COARSE_LOCATION, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE(+_LOCATION), VIBRATE. Added `res/xml/network_security_config.xml` (HTTPS-only) + referenced in <application>.
- DEBUG APK BUILT on this ARM64 container: installed JDK17→needed JDK21 (Temurin aarch64 to /opt/jdk21), Android cmdline-tools + platform-35 + build-tools 35.0.0 to /opt/android-sdk. ARM64 blocker: Android tools are x86_64 + no binfmt (unprivileged) → solved via amd64 multiarch glibc + qemu-x86_64-static wrappers for aapt2 & zipalign (renamed real binaries to .bin, shell wrappers exec qemu; AGP `android.aapt2FromMavenOverride` → wrapper). Gradle 8.11.1 fetched manually (services.gradle.org timed out) → distributionUrl=file:///tmp/...
- APK: `/app/frontend/android/app/build/outputs/apk/debug/app-debug.apk` (15MB), served at https://logistics-island.preview.emergentagent.com/downloads/islandhop-v1.0-debug.apk (debug-signed, sideload for team testing only).
- Webhooks verified 200 on BOTH preview and production (prod already redeployed with the routes). TWILIO_MESSAGING_SERVICE_SID present in .env.


### Jun 22, 2026 — Twilio fixes, WhatsApp/status webhooks, Play Store prep (Capacitor)
- Twilio: added `TWILIO_MESSAGING_SERVICE_SID=MG5c07e189324f5f2d77e196f0a3300fbd` to backend/.env (WHATSAPP_FROM=whatsapp:+12523746444 + MOCK_TWILIO=false already set).
- NEW webhooks: `POST /api/webhooks/whatsapp` (Twilio inbound; parses From/Body/MessageSid/ProfileName, logs to whatsapp_messages direction=inbound, returns empty TwiML XML) and `POST /api/webhooks/twilio-status` (delivery status callback; updates whatsapp_messages status + logs twilio_status_events). Both tested → 200.
- Play Store: wired `/privacy-policy` (PrivacyPolicy.js) and `/terms` (Terms.js) routes in App.js + footer links (footer-privacy, footer-terms). Real logistics-platform legal copy (data/location/driver/merchant terms, T&T jurisdiction). Added manifest.json + icon/apple-touch links in index.html.
- App assets: branded icons generated (public/icons: 16–512 + maskable 192/512 + adaptive fg/bg; public/splash). Master icon via image gen (gold parcel+palm on matte black).
- Capacitor 7 (Node 20 compatible; v8 needs Node 22) installed + configured: appId `com.islandhop.app`, appName `IslandHop`, webDir `build`. Android platform added; `@capacitor/assets` generated 74 native android assets (all densities + adaptive + splash light/dark). versionCode 1, versionName 1.0.
- ⚠️ NO .aab built — container has no Java/Gradle/Android SDK. Build on a machine with Android Studio: `cd /app/frontend && yarn build && npx cap sync android && cd android && ./gradlew bundleRelease` (then sign).
- ⚠️ Production: redeploy + add TWILIO_MESSAGING_SERVICE_SID to Deploy Panel; configure Twilio webhook URLs to https://islandhopapp.com/api/webhooks/whatsapp and /api/webhooks/twilio-status.


### Jun 20, 2026 — Full PayPal integration (Checkout + Payouts + Webhooks), mode-driven
- ⚠️ CREDENTIAL FINDING: the "LIVE" PayPal credentials provided are actually SANDBOX creds — verified: they 401 (invalid_client) on `api-m.paypal.com` (live) but return a valid token on `api-m.sandbox.paypal.com`. So `PAYPAL_MODE=sandbox` in .env (NOT live). Going truly live requires LIVE app credentials from the PayPal dashboard; then set PAYPAL_MODE=live + live client id/secret.
- NEW `backend/paypal_client.py`: REST API v2 via httpx (no SDK). Token caching, create_order, capture_order, get_order, create_payout (Payouts v1), verify_webhook (needs PAYPAL_WEBHOOK_ID). `_base_url()` switches on PAYPAL_MODE.
- NEW endpoints: `POST /api/payments/paypal/create-order` (wallet_deposit|order), `POST /api/payments/paypal/capture-order` (credits wallet via `_credit_wallet_with_txn`, idempotent via `_settle_paypal_order`), `GET /api/payments/paypal/order-status/{id}`, `POST /api/admin/paypal/payout` (admin), `POST /api/webhooks/paypal` (PAYMENT.CAPTURE.COMPLETED / PAYOUTS-ITEM.* — only acts on verified events). Collections: `paypal_orders`, `paypal_payouts`, `paypal_webhooks`.
- Frontend: `PaymentMethodsSelector.js` PayPal `enabled:true`; `WalletFunding.js` PayPal deposit → calls create-order → redirects to PayPal approve_url; `CheckoutPage.js` PaymentSuccess handles `via=paypal` (reads `?token=` order id → capture-order).
- Env added: PAYPAL_CLIENT_SECRET, PAYPAL_MODE=sandbox, PAYPAL_WEBHOOK_ID (empty — set after creating a webhook in PayPal dashboard pointing to /api/webhooks/paypal).
- VERIFIED on sandbox: token OK, create-order returns real order id + approve_url, order-status reads live+local, admin payout returns real batch id (PENDING). Capture/webhook code in place (capture needs buyer approval to fully exercise). NEEDS REDEPLOY for production — and do NOT deploy as live until live creds work.


### Jun 20, 2026 — WhatsApp-ONLY notification engine (Tracy's policy, bypasses A2P 10DLC)
- NEW unified `twilio_client.send_notification(to, body, channel="whatsapp", content_sid=, content_variables=)`: WhatsApp-first. On send failure → if error 63005 (no 24h session) log + skip (NO SMS fallback); on any other (synchronous) error → SMS fallback. `channel="sms"` forces SMS (OTP/verification only). Note: 63005 is an async delivery failure (Twilio accepts/queues synchronously), so it naturally never triggers SMS fallback.
- NEW reusable `_wa_notify(phone, body, ...)` in server.py: sends via send_notification + logs to `whatsapp_messages` (automated:true, event, channel_used, skipped). Never raises.
- Converted to WhatsApp-first: order status → customer (confirmed/picked_up/out_for_delivery/delivered); driver application status (approved/rejected/review — WhatsApp added alongside existing email); driver new-order requests; merchant application status (verified/rejected, on `/admin/businesses/{id}/approve|reject` via new `_notify_merchant_status`); team/admin new-application alert (WhatsApp to `ADMIN_NOTIFY_PHONE` env if set).
- OTP stays SMS (line ~7116). Manual admin WhatsApp compose unchanged.
- Admin Panel WhatsApp note updated: "Customers must message +1 (252) 374-6444 first… lifted once templates approved by Meta."
- Verified on preview: backend restarts clean, send_notification routes correctly (WhatsApp default, SMS forced for OTP), `_wa_notify` logs + Twilio 201. NEEDS REDEPLOY for production.


### Jun 20, 2026 — Automatic WhatsApp order-status notifications
- `update_order_status` now fires a best-effort WhatsApp message to the customer's `customer_phone` on key milestones: `confirmed`, `picked_up`, `out_for_delivery`, `delivered` (fire-and-forget, never blocks the status update). Logged to `whatsapp_messages` with `automated:true` + `event`.
- `twilio_client.send_whatsapp(to, body, content_sid=None, content_variables=None)` is now TEMPLATE-CAPABLE (Twilio Content API). If env `WHATSAPP_TEMPLATE_CONFIRMED_SID` / `WHATSAPP_TEMPLATE_PICKED_UP_SID` / `WHATSAPP_TEMPLATE_DELIVERED_SID` are set, sends the approved template (delivers outside the 24h window); otherwise sends free-form (delivers only inside the 24h session window). Map in `ORDER_WHATSAPP_EVENTS`.
- Verified on preview: helper builds the message, Twilio accepts (HTTP 201, real SID), DB logs it. Actual delivery still subject to WhatsApp's 24h/template rule (error 63005 for free-form outside window). PRODUCTION: redeploy + set `TWILIO_WHATSAPP_FROM` (and template SIDs once approved) in Deploy Panel.


### Jun 20, 2026 — Twilio WhatsApp enabled + admin compose UI
- Set `TWILIO_WHATSAPP_FROM=whatsapp:+12523746444` in backend/.env. `twilio_client.send_whatsapp()` (existing) uses the standard Twilio REST `Messages.json` with `whatsapp:` prefix on From/To.
- Admin Panel → WhatsApp tab: added a "Send a WhatsApp message" compose card (phone + message → `POST /api/whatsapp/send`) so admins/agents can start outbound chats to any driver/merchant number, not just reply. Test IDs: `wa-compose-phone`, `wa-compose-body`, `wa-compose-send-btn`, `wa-compose-feedback`.
- TEST RESULT (preview): Twilio ACCEPTED the test message to +15166057352 (status `queued`, `mock:false`, real SID) via both direct call and the API endpoint. BUT WhatsApp DELIVERY FAILED with **error 63005** (generic WhatsApp layer failure → maps to WhatsApp 1000). Cause: WhatsApp blocks business-initiated FREE-FORM messages outside the 24h customer-service window. To deliver: recipient must message the WhatsApp sender first (opens 24h session) OR use an approved WhatsApp template. Integration/config is correct; this is a WhatsApp policy rule, not a code bug.
- PRODUCTION: needs redeploy + `TWILIO_WHATSAPP_FROM` set in Deploy Panel.


### Jun 20, 2026 — Application email notifications + diagnosis of islandhoptt.com form
- DIAGNOSIS: public intake API (`/api/public/applications/driver|merchant`), CORS/preflight, admin pending-approvals (with "🌐 Lead from islandhoptt.com" badge), and M365 mail are ALL working on PRODUCTION (verified live — a direct curl test landed in Admin → Approvals). Root cause of "applications not registering": the form on islandhoptt.com is a **website-builder native form** (item 2.b) that shows its own success message and does NOT POST to our API. Fix = embed the connect-kit form (raw HTML+JS fetch to `islandhopapp.com/api/...` with `X-API-Key`) on islandhoptt.com.
- ADDED: `_notify_new_application()` — on every public application, emails an internal alert routed to the correct inbox (driver→`drivers@islandhoptt.com`, merchant→`partner@islandhoptt.com`) AND an acknowledgement to the applicant. Fire-and-forget (never blocks intake). Env-overridable via `DRIVER_NOTIFY_MAILBOX`/`MERCHANT_NOTIFY_MAILBOX`. Verified on preview (no errors). Needs redeploy for production.


### Jun 20, 2026 — WiPay Caribbean sandbox checkout + auth-token-key bug fix
- WiPay hosted checkout added as an alternative to Stripe. New `backend/wipay_client.py`; endpoints `POST /api/payments/wipay/checkout/session` and public `GET /api/payments/wipay/callback` (md5 hash verify, marks order paid, redirects to `/payment/success?via=wipay`). Env: `WIPAY_ACCOUNT_NUMBER/API_KEY/ENVIRONMENT/COUNTRY_CODE/CURRENCY` (sandbox: 1234567890 / 123). Frontend "Pay with WiPay" button on `CheckoutPage.js`. Verified end-to-end on preview against real tt.wipayfinancial.com sandbox.
- FIXED (P0): `WalletPage.js`, `CheckoutPage.js`, `VendorStripeConnect.js` read `localStorage.access_token` (never set) → sent no auth header → false "Not authenticated / Failed to load wallet" banner. Now read `localStorage.token`. Root cause of the long-standing wallet error banner. Verified: wallet + checkout load cleanly, no banner.
- Twilio SMS confirmed LIVE on preview (real SID returned via `twilio_client.send_sms` and `/api/otp/send`).


### Jun 2026 — Fixed Twilio "failed to send" (uncaught errors + phone format)
- ROOT CAUSE: with `MOCK_TWILIO=false`, `twilio_client._real_send_sms/_real_send_whatsapp` RAISED on any failure → uncaught 500 "failed to send". WhatsApp always crashed (no `TWILIO_WHATSAPP_FROM`). Also `_normalize_phone` didn't add a country code, so bare local numbers (e.g. `7654321`) were rejected by Twilio.
- FIX: twilio_client now RETURNS `{success:False, error, error_code}` (never raises) + same-number guard. `_normalize_phone` now produces E.164, defaulting bare 7-digit numbers to Trinidad `+1868`, 10-digit→`+1`, 11-digit→`+`. OTP endpoint handles send failure gracefully (preview still returns dev_code; prod raises a friendly 400). WhatsApp endpoint returns clean 400 when no WA sender. Used **400 not 502** because Cloudflare masks origin 5xx with its own error page.
- SMS itself works (Twilio 201). Tests: `tests/test_twilio_graceful.py` 5/5. NOTE: A2P 10DLC still recommended for US-destination delivery; WhatsApp stays disabled until a WA sender is provisioned.


### Jun 2026 — Twilio SMS went LIVE (OTP)
- Flipped `MOCK_TWILIO=false`; set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM=+12523746444` in backend/.env. Installed `twilio==9.10.9` (in requirements.txt). Account validated via REST API: status=active, type=Full (paid), number +12523746444 is SMS-capable. Live path confirmed (Twilio auth succeeded; only rejected a same-number self-test). `twilio_client.py` already used the correct env var names + `messages.create(from_=...)`.
- WhatsApp left OFF (`TWILIO_WHATSAPP_FROM` empty) — needs a separate WhatsApp-enabled sender. CAVEAT: US long-code (+1252) A2P 10DLC registration recommended for reliable US-destination SMS; T&T (+1868) is international. PREVIEW now sends REAL SMS on phone signups. PRODUCTION: add the 3 TWILIO_* vars + MOCK_TWILIO=false to the Deploy panel + redeploy.


### Jun 2026 — Public application intake from islandhoptt.com (external leads)
- New UNAUTHENTICATED endpoints so the external marketing site submits partner applications that land in Admin → Pending Approvals: `POST /api/public/applications/driver` and `POST /api/public/applications/merchant`.
- Leads insert into existing `drivers` (status=pending) / `business_applications` (verification_status=pending) with `source:"islandhoptt.com"` + `is_external_lead:true`, `user_id:null` — appear alongside in-app applications, reuse existing approve/reject. `_flatten_pending` returns `source`; AdminPanel shows a "🌐 Lead from islandhoptt.com" badge.
- Spam protection: per-IP **rate limit 5/hr** (`public_application_log`, X-Forwarded-For aware)→429; **honeypot** `hp` field (silently accepted, not stored); **optional `X-API-Key`** vs `PUBLIC_APPLICATIONS_API_KEY` (backend/.env). CORS wildcard already allows islandhoptt.com.
- Tested: `tests/test_public_applications.py` 4/4 + curl rate-limit verified; test data cleaned. PRODUCTION: add `PUBLIC_APPLICATIONS_API_KEY` to Deploy panel + redeploy.

### Jun 2026 — Facebook Login config staged (App ID 2180974786018435 in FB_APP_ID/REACT_APP_FB_APP_ID; awaiting App Secret before building the button).


### Jun 2026 — Support inbox workflow: instant auto-reply + assign-to-agent
- New workflow on the Admin → Mail tab (`AdminMailInbox.js`): (1) **instant auto-reply** to NEW inbound client emails with admin-editable template (subject + `{name}` placeholder body), enable/disable toggle, and a manual **"Run now"**; (2) **assign-to-agent** per email (admin assigns any admin/agent; agent self-claims) with assigned/auto-replied/resolved **badges** + **Mark resolved**.
- Safety: a **watermark** (`autoreply_since`) means enabling NEVER blasts the existing mailbox backlog (only mail received after enablement); **one auto-reply per conversationId** (idempotent); skip rules for no-reply/notification/mailer-daemon senders + "Auto:"/"Automatic reply" subjects to prevent loops.
- Backend (`server.py`): `/api/admin/mail/auto-reply/settings` GET/PUT, `/auto-reply/run` POST, `/team` GET, `/tickets` GET, `messages/{id}/assign` POST, `messages/{id}/resolve` POST; message-list endpoint now enriches each message with a `.ticket` (auto_replied/assignment/status). Mail read/reply endpoints opened to `admin`+`agent`. New collection `mail_tickets`; settings in `app_settings` doc `mail_autoreply`. `graph_mail.list_messages` now selects `conversationId`.
- Background poller (every 2 min) is **gated by env `MAIL_AUTOREPLY_POLL_ENABLED` (default off)** so only ONE environment auto-replies to the shared mailboxes. **PRODUCTION must set `MAIL_AUTOREPLY_POLL_ENABLED=true`** in the Deploy panel for fully-automatic instant replies; otherwise admins use "Run now". Preview intentionally leaves it off.
- Tested: `test_mail_autoreply_workflow.py` 10/10 pytest + full frontend QA (iteration_16) = 100%, zero bugs. Auto-reply template restored to production default after QA.

### Jun 2026 — M365 Mail production fix + deployment blockers
- **Root cause of "approval pending" on live site:** production ran with PLACEHOLDER M365 creds (`M365_TENANT_ID=logistics-island`). Admin consent was NOT the issue (already granted in Azure). Corrected `backend/.env` to the verified-working app: tenant `2c1ceb20-5931-4915-8876-ce77f7b4152b`, client `3547d007-5f7f-49e0-8400-c531e9ff1824`, secret `X9e8Q~...`. Verified on preview: `consent_granted:true`, 19 Graph roles, real emails load from all 7 mailboxes; admins can reply via Admin → Mail tab.
- **IMPORTANT for production:** backend loads `.env` WITHOUT override (`dotenv_override_detected:false`), so Deploy-panel env vars win. To go live the user must (a) update any M365_* Deploy-panel vars from `logistics-island` to the real values above, and (b) redeploy. If no Deploy-panel M365 overrides exist, a plain redeploy picks up the corrected committed `.env`.
- Tracy explored a second app `84d3c4ea-...` but only ever provided GUID IDs (Secret ID / Object ID), never the actual Client Secret VALUE → AADSTS7000215. Decision: stay on the working `3547d007-...` app (Option A). `84d3c4ea-...` historically lacked Mail permissions/consent.
- **Deployment readiness: PASS (0 blockers).** Fixed 4 unbounded Mongo queries flagged by deploy scan: `get_user_orders` (customer/restaurant/driver order lists → `.sort(created_at desc).limit(200)`) and `push_subscriptions` fetch (`.limit(50)`).

### Jun 2026 — "Midnight Tropical" theme re-skin (whole app)
- Re-themed the entire app from the old Matte-Black/Gold/Cyan look to **Midnight Tropical**: deep navy/charcoal base + **sunset-orange** primary + **teal** secondary accent. User-requested, mobile-first marketplace direction (Uber/DoorDash-style but dark).
- Done centrally via design tokens (no per-component churn): `tailwind.config.js` repurposed `matte`→navy scale (`#0A1824/#102433/#1C3A52`), `gold`→sunset-orange (`#FDBA74/#F97316/#EA580C`), `neon.cyan`→teal (`#2DD4BF`); updated `gold-gradient` bg images, `gold-glow`/`cyan-pulse` shadows. `index.css` `:root`+`.dark` CSS vars now midnight (bg `hsl(207 56% 9%)`, primary orange `hsl(25 95% 53%)`, accent teal `hsl(172 66% 50%)`), plus `.text-gold`/`.text-gold-gradient`/selection/scrollbar. Literal hex updated in `LiveOrderMapPreview.js` + `celebrate.js`; orange radial-glow in `App.js`.
- NOTE: legacy token names (`matte`/`gold`/`neon.cyan`, `.text-gold`, `bg-gold-gradient`, `shadow-gold-glow`) are intentionally reused for the re-skin — they now render navy/orange/teal. Comment added in tailwind.config.js. Future refactor could rename to `navy-/sunset-/teal-`.
- Preview-only page `/theme-preview` (and `?opt=3`) added earlier for palette comparison (light Option 2/3); left in place, harmless.
- Verified: frontend compiles clean; testing agent iteration_15 = 100% visual readability across Landing, Login, Dashboard, Admin (Overview/Users/Orders/Approvals), Restaurants, shadcn popover/dialog/dropdown. No JS errors or contrast regressions from the theme.


- Verified "hardcoded secrets" findings are FALSE POSITIVES (throwaway test passwords like `Test1234!` for ephemeral runtime accounts; `graph_mail.py:139` is OData `$skiptoken=` pagination parsing). Real secrets remain in `.env`.
- `pyflakes` on all backend modules = **0 undefined names** → the "18 undefined variables" are false positives (analyzer can't resolve dynamic/imported names). No crash risk.
- Fixed the one in-scope item: empty error handler in `AdminTeam.js` audit-log loader now logs at debug level.
- DEFERRED (high-risk on a LIVE app, need a dedicated tested phase): localStorage→httpOnly cookie auth migration (~20 files); adding the intentionally-suppressed React hook deps (suppressed to prevent infinite render loops); splitting large components (AdminPanel 1022 lines, BusinessOnboarding 1211); backend high-complexity refactors; wholesale console-statement removal.

### Jun 2026 — OAuth-account login crash fix + login error UX + production www-URL diagnosis
- **Login 500 crash fixed**: OAuth-only users (Google/Microsoft, no `hashed_password`) attempting email/password login crashed `pwd_context.verify` (empty hash). Now `verify_password` defensively returns False on empty/invalid hashes, and `/auth/login` returns a clear 401: "This account uses Google/Microsoft sign-in. Please use the Continue with {provider} button." (provider-aware via `auth_provider`).
- **Login error UX bug fixed**: `api.js` response interceptor redirected to `/login` on ANY 401 — including the login call itself — so failed logins silently reloaded and NEVER showed an error. Now skips redirect for `/auth/login` & `/auth/register`. AuthPage shows an inline red error banner (`data-testid="auth-error-message"`) instead of `alert()`; handles string + array(422) details.
- Tests: `tests/test_oauth_login_guard.py` (4 passing). Verified banner in-browser.
- **withCredentials → false** across all 57 frontend call sites (auth is Bearer-token; avoids cross-origin credentialed-CORS blocks).
- **PRODUCTION login still broken — platform/domain issue (NOT code)**: deployed frontend bundle is built with `REACT_APP_BACKEND_URL=https://www.islandhopapp.com` (www), which 308-redirects to the apex, blocking browser API calls. Backend at apex `islandhopapp.com` is healthy (register/login return 200 directly; CORS correct). `REACT_APP_BACKEND_URL` is auto-set by the platform and not user-editable; re-link+redeploy did not regenerate the bundle. ESCALATED to support@emergent.sh: need canonical domain set to apex `islandhopapp.com` + forced clean frontend rebuild. Deployment health check: PASS (0 blockers).


**Merchant reviews (Google-style, on RestaurantMenu `/restaurant/:id`):**
- New collection `merchant_reviews`. Endpoints: `GET /api/merchants/{id}/reviews` (public: returns `{summary:{average,count,distribution}, reviews, can_reply}`; optional auth sets can_reply), `POST /api/merchants/{id}/reviews` (auth; upsert one review per customer; rating 1-5 + comment), `POST /api/merchants/{id}/reviews/{review_id}/reply` (merchant owner via restaurants/businesses/car_rental_companies.user_id, or admin).
- Frontend `MerchantReviews.js`: avg + star-distribution bars, write-review form (StarPicker + comment), review cards (avatar/name/stars/date/comment), nested merchant reply, owner-only reply form. Mounted at bottom of RestaurantMenu.
- Tests: `tests/test_merchant_reviews.py` (5 passing).

**Driver multi-area reviews + MONTHLY tiered incentives:**
- 5 rating areas (customer rates post-delivery): Overall(`driver_rating`), Punctuality/Speed(`delivery_speed`), Professionalism(`driver_professionalism`), Care(`driver_care`), Communication(`driver_communication`). Added 3 new fields to Rating + RatingCreate models and `create_rating`. `ReviewForm.js` extended with the 4 sub-area star rows (also fixed token-key bug: `access_token`→`token`).
- Monthly engine: `GET /api/admin/driver-incentives/leaderboard?month=YYYY-MM` (per-area avgs, composite, deliveries, ratings_count, qualified flag, ranked) and `POST /api/admin/driver-incentives/run-monthly` (pays tiered top-3, idempotent per month). Config: tiers $200/$100/$50 USD; qualify ≥20 deliveries AND ≥10 ratings/month. Writes `driver_incentives` docs type `monthly_top_driver`. (Existing weekly bonus untouched.)
- Frontend: new Admin tab "Incentives" (`AdminDriverIncentives.js`) — month picker, tier/threshold banner, leaderboard table with per-area scores + medals for top-3, "Run payout" button (disabled when 0 qualified or already paid), awarded banner.
- Tests: `tests/test_driver_monthly_incentives.py` (2 passing — seeds qualifying driver via fresh Motor client, verifies rank/payout/idempotency via HTTP).

**Compact footer:** `Footer.js` condensed from a large 3-col block (5 big email cards) into a slim single row (brand + Instagram + 5 inline contact pills + thin copyright/website/About row). `mt-20`→`mt-12`, `py-12`→`py-7`.

All verified: 16 new backend tests pass; merchant-reviews UI, admin incentives tab, and tracking map confirmed in-browser.


- **OrderTrackingPageWithMaps.js bug FIXED**: page crashed with `Cannot read properties of undefined (reading 'maps')` because `new window.google.maps.Size(40,40)` was evaluated inline in Marker icon JSX BEFORE LoadScript injected `window.google` → the whole tracking page went blank ("Oops! Something went wrong"). Fix: removed the redundant `scaledSize` (the SVG markers are already 40×40). Verified in-browser: map tiles + delivery marker render, no crash overlay. (This was the real cause of the grey map — NOT the API key.)
- **Full E2E run (iteration_14, PREVIEW)**: restaurant onboarding + menu → driver KYC + admin approval + go-online → customer order → Stripe TEST checkout (paid) → driver assignment → delivery lifecycle → POD upload → driver wallet credit. ALL PASS. Backend 29/29 (20 E2E + 4 profile + 5 Microsoft). Login→dashboard + profile flows verified.
- `test_e2e_dryrun_iter12.py` updated by testing agent: logs in as the seeded owner admin (post registration-lockdown, /auth/register always returns customer).
- Driver doc upload `doc_type` values are camelCase: `driversLicense`, `vehicleRegistration`, `insurance`, `certificateOfCharacter`, `profilePhoto`.


- **LOGIN BUG FIXED**: email/password login stored the JWT but used `navigate('/dashboard')` (SPA nav). `AuthContext` only runs `checkAuth()` once on mount and exposes no refresh, so it stayed logged-out and `ProtectedRoute` bounced the user back to `/login` (showed generic "Authentication failed"). Fix: `AuthPage.js` now does `window.location.href = '/dashboard'` after login/signup (matches the Google/Microsoft callback pattern → forces AuthContext re-hydration). Verified end-to-end in browser.
- **CORS FIX** (earlier this session, related): `allow_credentials=True` + `allow_origins=["*"]` is forbidden by browsers for credentialed requests → blocked cross-origin (custom-domain) calls. `server.py` now uses `allow_origin_regex=".*"` when origins are wildcard (reflects exact origin + Allow-Credentials). Requires redeploy for production.
- **Customer profile**: new `PUT /api/users/me` (UserProfileUpdate: name/phone/picture/address; ~2MB base64 picture guard). New `ProfilePage.js` at `/profile` (ProtectedRoute) — avatar upload (client-side canvas resize to 400px → base64 jpeg), name/phone, address (street/city/country); required picture+address before save. Dashboard shows a "Complete your profile" banner when picture/address missing, an "Edit Profile" button, and the address on the Profile card.
- Tests: `tests/test_profile_update.py` (4), `tests/test_microsoft_social_login.py` (5) — all passing.
- Google Maps: user moved to a billing-enabled key `AIzaSyC4-...` (swapped into both .env). Maps JS + Directions APIs verified working via live browser render. Map displays. (Production needs the same key set in Deploy env + redeploy.)


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

## CHANGELOG — 2026-06-22: Vibrant "Caribbean Sunshine" Light Theme (global)
- Migrated the ENTIRE app from dark "Midnight Tropical" to a VIBRANT light theme matching user's reference screenshots (warm off-white bg, white cards, deep navy headings/text, bright teal accents, vivid orange CTAs).
- Mechanism (avoids touching 130+ files): legacy Tailwind tokens remapped in `tailwind.config.js` — `matte-900=#FFFCF9` (page bg), `matte-800=#FFFFFF` (cards), `matte-700=#EEF2F7`; `gold-500=#FF6A00` (vivid orange), `gold-700=#E85D00`, `gold-300=#FFB37A`, `gold-400=#FF8A3D`; `neon.cyan=#06D6BE` (bright teal); new `navy` palette (#0B2C54). Gradients/glows refreshed.
- `public/index.html`: removed forced `class="dark"`. `src/index.css`: `:root` semantic vars → primary=orange `25 100% 50%`, accent=teal `173 94% 43%`, secondary=navy `211 77% 19%`, foreground=navy, light scrollbar/selection.
- Contrast sweep: converted misused `text-white` text labels (PartnerSelection, ReviewForm, order-form Totals, Terms/Privacy headers) to `text-secondary`/`text-foreground`; renamed `text-neon-cyan`→`text-teal-700` across 19 files; pale `bg-gold-500/15 text-gold-300` badges → `text-gold-700`.
- Verified: testing agent iteration_18 (95% → contrast bugs fixed) + screenshots on Home, Partner, Car Rentals, Login, Pharmacy, and authed Dashboard/Admin/Wallet.
- DEPLOY: live on preview. Production (islandhopapp.com) requires the user to trigger the Deploy panel manually. (Note: pre-existing apex/www POST-redirect blocker may still affect production until Emergent Support rebuilds the apex bundle.)
- Pre-existing unrelated: `/dashboard` applications fetch returns 500 (console error only, page still renders) — NOT caused by theme.

## CHANGELOG — 2026-06-22 (code review fixes, safe subset)
- Fixed 3 empty catch blocks to log errors: WalletFunding.js, MerchantReviews.js, AdminTeam.js.
- wipay_client.py: marked protocol-mandated MD5 hash `usedforsecurity=False` (WiPay API requires md5(transaction_id+total+api_key); cannot change algorithm without breaking payment verification).
- FALSE POSITIVES (no change): server.py:5627 is a comment (only real hash is sha256 HMAC @7811); graph_mail.py:139 is `$skiptoken` URL parsing; test-file "secrets" are pytest fixtures.
- Hook-dependency warnings: this CRA project does NOT enable the `react-hooks/exhaustive-deps` rule, so there are no such warnings in the actual build. Attempted eslint-disable comments broke compilation (rule undefined) and were reverted. App behavior already correct; no change needed. NOTE: required `rm -rf node_modules/.cache` + frontend restart to clear stale eslint cache.
- Backend verified healthy (curl 200); frontend "webpack compiled successfully"; homepage smoke screenshot OK.
- DEFERRED (high-risk, need dedicated effort + testing): localStorage→httpOnly cookie auth migration (P1 security), splitting BusinessOnboarding/AdminPanel/server.py, backend complexity reduction, type hints, console-statement stripping, nested-ternary cleanup.

## CHANGELOG — 2026-06-23: Promoter QR System + Global TT$/US$ Currency Toggle
### A) Promoter / Ambassador QR system (verified 100% — iteration_19/20)
- Every user gets a personal QR + referral code; sharing onboards customers/drivers/businesses/suppliers.
- Wallet rewards (USD base): customer $5 (on 1st paid order), driver $25, merchant $40, supplier $40 (on admin approval). Paid instantly if promoter eligible (admin-approved Ambassador OR active/approved account), else HELD and auto-released on eligibility.
- Backend (server.py): GET /api/promoter/me, /onboards, /leaderboard, /resolve/{code}; GET /api/admin/promoters; POST /api/admin/promoters/approve|revoke. Reward hooks in _maybe_complete_referral, admin_approve_driver, admin_approve_business. New collection: promo_rewards. Reuses referral_codes + user.referred_by for attribution.
- Frontend: PromoteEarn.js (/promote, QR + download PNG + share + totals + onboards + leaderboard), JoinLanding.js (/join/:code public invite, 4 onboarding paths → /signup?ref=CODE&intent=), AdminPromoters.js (admin 'Promoters' tab). Nav + footer links added.
- Env tunables: PROMO_REWARD_CUSTOMER/DRIVER/MERCHANT/SUPPLIER, PROMO_REWARD_CURRENCY (default USD).

### B) Global TT$ / US$ currency display toggle (verified 100%)
- All catalog/order/subscription prices authored in USD; DISPLAY TT$ by default (rate 6.78), navbar switcher flips to US$, persisted in localStorage 'display_currency'.
- CurrencyContext.js (CurrencyProvider, useCurrency, Price, CurrencySwitcher, RATE_TTD_PER_USD=6.78). Provider wraps app; switcher in navbar (authed + guest).
- Converted: SubscriptionPlans, RestaurantMenu, Grocery/Pharmacy/Courier/CarRental/Taxi order forms, CheckoutPage, OrderTrackingPageWithMaps, PromoteEarn rewards.
- Grand totals on grocery/pharmacy/checkout use existing CurrencyConverter widget (shows BOTH currencies). Wallet balances + driver/vendor EARNINGS dashboards intentionally kept in native currency (real settlement amounts) — out of scope.
- DEPLOY: both features live on PREVIEW only; user must redeploy via Deploy panel for production (islandhopapp.com).

## CHANGELOG — 2026-06-23 (WhatsApp delivery visibility fix + UX additions)
### WhatsApp dashboard "not connected" — ROOT CAUSE + FIX (verified 100%, iteration_21)
- Diagnosed via Twilio API: outbound msgs reach Twilio (200/queued) then FAIL async with error 63005 (recipient outside WhatsApp's 24h customer-care window; business-initiated free-form requires an approved template). Dashboard never showed it because sends had no status_callback → stuck at "queued". Inbound works (webhook receives msgs).
- FIX: twilio_client.py now passes status_callback on SMS + WhatsApp sends (_status_callback_url(): env TWILIO_STATUS_CALLBACK_URL, fallback FRONTEND_URL + /api/webhooks/twilio-status). Existing POST /api/webhooks/twilio-status updates whatsapp_messages status+error_code. AdminPanel whatsapp thread now shows per-message delivery status + a clear note when failed due to the 24h window.
- .env (preview): added TWILIO_STATUS_CALLBACK_URL=<preview>/api/webhooks/twilio-status. PRODUCTION: falls back to FRONTEND_URL (islandhopapp.com) automatically.
- IMPORTANT: WhatsApp 24h-window/template requirement is Meta/Twilio POLICY, not a bug. To message customers who haven't contacted you in 24h, approved Message Templates (Content API content_sid) are required — twilio_client.send_whatsapp already supports content_sid; map approved template SIDs to env once Meta approves them.
### UX additions
- Dashboard quick-action tile "Promote & Earn" (data-testid quick-action-promote) → /promote.
- Signup: SMS consent line under Phone (data-testid sms-consent-text) for Twilio A2P. Fixed broken signup links /terms→/terms-and-conditions, /privacy→/privacy-policy.

## CHANGELOG — 2026-06-23 (Business model explanations + analytics promotions + homepage incentives widget) — verified 100% (iteration_22)
- BusinessOnboarding.js: 'Business Model' field now shows a description + an explanatory legend for each option (B2C, B2B, B2B2C, Marketplace, Subscription). renderField supports field.description + field.optionDescriptions generically.
- AnalyticsPromotions.js: new card in Admin Panel Analytics tab — total paid to promoters, held, total onboards, approved ambassadors + Top Promoters list (pulls /api/admin/promoters + /api/promoter/leaderboard).
- App.js homepage: new horizontal 'Earn with IslandHop' incentives widget (data-testid incentives-widget) on navy gradient with 4 cards (Promote & Earn → /promote highlighted, Refer Friends → /referrals, Drive & Earn → /partner, Partner Bonuses → /partner) + 'Get my QR code' CTA.
- All live on PREVIEW only — redeploy via Deploy panel for production.

## CHANGELOG — 2026-06-23 (Dynamic homepage social proof)
- New public endpoint GET /api/promoter/social-proof → top promoter's earnings THIS MONTH (first name only) + onboards_this_month. Verified with temp data (Tracy / 40 USD), test doc cleaned up.
- New component PromoterSocialProof.js wired into the homepage incentives widget header — shows a live pulsing badge "<Name> earned <TT$ amount> this month · N new sign-ups" using the global currency formatter. Renders nothing (graceful) until there is real paid-this-month data.
- PREVIEW only — redeploy for production.

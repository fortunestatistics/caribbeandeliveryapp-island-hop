# IslandHop — Go-Live Reference (payment keys parked; app is in TEST mode)

Current mode (as of Jul 4, 2026): **TEST / SANDBOX — no real money moves.**
- Stripe: TEST key active (`STRIPE_API_KEY=sk_test…`). Live keys PARKED (not used by code) below.
- PayPal: `PAYPAL_MODE=sandbox` (SAFE for now). NOTE: the only PayPal creds we have are LIVE (see below) — there are NO sandbox creds, so PayPal checkout is non-functional in preview until you flip to live.
- WiPay: `WIPAY_ENVIRONMENT=sandbox`.

## PayPal LIVE creds — CONFIRMED WORKING (Jul 4, 2026)
Existing `PAYPAL_CLIENT_ID` (AQR9lKfu…) + `PAYPAL_CLIENT_SECRET` (EJCgWW…) authenticate on **api-m.paypal.com (LIVE) → HTTP 200**, 401 on sandbox. These ARE live credentials (supersedes the old "sandbox-only" note).
### To GO LIVE with PayPal
1. backend/.env: `PAYPAL_MODE=sandbox` → `live` (client id/secret already correct).
2. Set `PAYPAL_WEBHOOK_ID` (create a live webhook in the PayPal dashboard → /api/webhooks/paypal).
3. Set `PAYPAL_MODE=live` (+ client id/secret) in the Deploy panel; redeploy.


## Parked LIVE Stripe keys (switch when you give the go)
Stored (unused) in env so they're ready:
- Backend `backend/.env`: `STRIPE_LIVE_API_KEY` (sk_live…), `STRIPE_LIVE_PUBLISHABLE_KEY` (pk_live…)
- Frontend `frontend/.env`: `REACT_APP_STRIPE_LIVE_PUBLISHABLE_KEY` (pk_live…)

### To GO LIVE with Stripe (preview + production)
1. backend/.env: set `STRIPE_API_KEY` = the `STRIPE_LIVE_API_KEY` value.
2. frontend/.env: set `REACT_APP_STRIPE_PUBLISHABLE_KEY` = the `REACT_APP_STRIPE_LIVE_PUBLISHABLE_KEY` value.
3. Restart backend + frontend (or redeploy for production; also set both in the Deploy panel env vars).
4. Verify: `curl -s https://api.stripe.com/v1/balance -u "<sk_live>:"` → `livemode: true` (no charge).

## SECURITY
- The live keys were shared in chat — recommend ROTATING them in the Stripe Dashboard, then updating the parked values here + Deploy panel.
- `sk_live` must ONLY ever live in backend `.env` / Deploy panel — never in frontend or client code. (Publishable `pk_live` is safe to expose.)

# IslandHop — Go-Live Reference (payment keys parked; app is in TEST mode)

Current mode (as of Jul 4, 2026): **TEST / SANDBOX — no real money moves.**
- Stripe: TEST key active (`STRIPE_API_KEY=sk_test…`). Live keys PARKED (not used by code) below.
- PayPal: `PAYPAL_MODE=sandbox` (the provided PayPal creds are sandbox-only anyway).
- WiPay: `WIPAY_ENVIRONMENT=sandbox`.

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

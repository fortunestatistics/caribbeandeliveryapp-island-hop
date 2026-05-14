# IslandHop — Product Requirements Document

## Original Problem Statement
Build **IslandHop**, a comprehensive Caribbean delivery app with multi-service capabilities (Food, Pharmacy, Groceries, General Courier, Taxi, Car Rental). Key requirements:
- Real-time order tracking with live GPS
- In-app messaging and AI customer support
- Multiple payment methods: cards, digital wallets, cash on delivery, Stripe (Apple/Google Pay)
- DoorDash-like UI with vibrant Caribbean theme
- Mobile-responsive with hamburger menu
- Robust onboarding for:
  - **Drivers**: 5-step (Personal Info → Vehicle → Documents → Banking → Review)
  - **Restaurants**: 5-step (Business → Hours → Documents → Banking → Review)
  - **General Businesses/Suppliers**: 6-step flow across categories
- Car Rental Companies with fleet management
- KPI Dashboard (delivery time, on-time rate, CSAT, driver perf.)

## User Personas
- **Customer**: orders food/groceries/pharmacy/courier; books taxis & car rentals; tracks orders live.
- **Restaurant Vendor**: manages menu, accepts orders, views earnings & payouts.
- **Driver**: receives nearby orders, accepts, navigates, earns commission.
- **Business / Pharmacy / Grocery / Car Rental**: onboards via 6-step partner flow, manages catalog.
- **Admin**: monitors platform health, KPIs, payouts, support tickets.

## Architecture
- **Frontend**: React + Tailwind + Shadcn UI. `App.js` routes all pages.
- **Backend**: FastAPI single-module `server.py` (~4.2k lines). Will be split into routers in future iterations.
- **DB**: MongoDB (Motor async driver). Geospatial 2dsphere index for driver locations; TTL index on history.
- **Real-time**: WebSockets (custom `ConnectionManager`) for order updates, driver-location pushes, notifications.
- **Auth**: JWT Bearer (primary) + session_token cookie (legacy/OAuth). `get_current_user_from_request` accepts both.
- **Payments**: Stripe (Elements, Connect Express for vendor/driver payouts, Apple/Google Pay).
- **Maps**: Google Maps JS API (`@react-google-maps/api`, key in `frontend/.env`).
- **Search**: `/api/search` aggregates across vendors and (future) products.

## What's Implemented (CHANGELOG)
### Feb 2026 (current fork)
- Order Scheduling backend (`POST/GET/DELETE /api/scheduled-orders`, `GET/DELETE /api/recurring-orders`) with daily/weekly/monthly recurrence and `next_occurrence` calculation.
- Wired `/scheduled-orders` route + `OrderScheduling.js` page into App.js.
- Patched `get_current_user_from_request` to accept JWT Bearer (was session_token-only) — unblocks all recently-added customer routes.
- Fixed 6 critical 500 errors caused by ObjectId leaks: `/addresses`, `/promo-codes`, `/support/tickets`, `/support/tickets/{id}`, `/drivers/{id}/wallet`, `/restaurants`.
- Removed two duplicate route registrations: `GET /auth/me` and `PUT /orders/{order_id}/status`.
- Hardened `PUT /addresses/{id}` against ownership hijack (force `user_id` from JWT).
- Fixed `GET /promo-codes/{code}/validate` naive-vs-aware datetime crash.
- Backend test suite: **27/27 passing** (`/app/backend/tests/test_islandhop_backend.py`).

### Previous sessions
- Phase 1: Driver/Restaurant/Business onboarding, partner selection, landing page.
- Phase 2 (most): Global search, commissions & vendor payouts (VendorPayout + DriverWallet models), Google Maps tracking, Vendor/Driver/Admin dashboards, Menu Management, Promo Codes, Address Management, Customer Support tickets, Ratings & Reviews, 5 payment methods (Stripe Elements + Apple Pay + Google Pay + PayPal placeholder + COD), Push-notifications infra.

## Roadmap

### P0 (next)
- Frontend E2E smoke-test new dashboards (Vendor / Driver / Admin) and Order Scheduling UI.
- Verify Google Maps tracking renders on `OrderTrackingPageWithMaps`.

### P1
- Authenticate `POST /api/promo-codes/{code}/apply` via JWT (currently takes `user_id` as query param — security gap).
- Migrate `POST /api/drivers/{id}/location` from query-params to JSON body.
- Persist chat history for order tracking conversations.
- Confirm Stripe Connect actually executes payouts (currently looks DB-mock-ish).
- Audit all PUT handlers for client-controlled `user_id`/`owner_id` (same shape as the address bug we fixed).
- Standardise datetime handling: always UTC-aware end-to-end.

### P2
- Detailed payment analytics & forecasting dashboard.
- Modularise `server.py` into routers (`auth`, `orders`, `scheduled_orders`, `vendors`, `drivers`, `payments`, `analytics`).
- Break down `App.js` (~2.9k lines) into per-route page components.
- Cron worker that auto-creates the next scheduled order from `RecurringOrder.next_occurrence`.

## Key DB Schema (selected)
- `Order`: id, status, subtotal, total, platform_fee, vendor_earnings, driver_earnings, …
- `ScheduledOrder`: id, user_id, service_type, scheduled_datetime, status, is_recurring, recurring_order_id
- `RecurringOrder`: id, user_id, recurrence_pattern, recurrence_days[], next_occurrence, active, orders_created
- `VendorPayout`, `DriverWallet`, `Rating`, `MenuItem`, `PromoCode`, `Address`, `SupportTicket`, `SupportMessage`, `DriverLocation`, `Notification`

## Integrations
- Google Maps API (key in `.env`)
- Stripe (test keys in pod env)
- WebSockets (in-house)
- Firebase placeholder for push notifications (keys not yet provided)

## Test Credentials
See `/app/memory/test_credentials.md`. No seeded users; tests register fresh users per run.

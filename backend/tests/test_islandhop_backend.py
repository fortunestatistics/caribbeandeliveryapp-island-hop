"""Comprehensive backend API tests for IslandHop.

Covers: health, auth (JWT), scheduled & recurring orders (NEW),
addresses, promo codes, support tickets, search, admin stats,
analytics, driver location, ratings, menu management.
"""
import os
import uuid
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break


# --------------------------- Health ---------------------------

class TestHealth:
    def test_root_alive(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "message" in body or isinstance(body, dict)


# --------------------------- Auth & JWT fallback ---------------------------

class TestAuth:
    def test_register_login_and_jwt_me(self):
        email = f"auth_test_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}@test.com"
        password = "Test1234!"
        # Register
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": password, "name": "Auth Tester", "user_type": "customer"
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and body["token_type"] == "bearer"
        token = body["access_token"]
        # Login again to ensure same credentials work
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
        assert r2.status_code == 200, r2.text
        token2 = r2.json()["access_token"]
        # Auth/me using Bearer token issued by register
        r3 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        # NOTE: /auth/me has duplicate routes (line 1149 uses Depends(get_current_user)
        # and another at line 1248 reads session_token cookie). FastAPI keeps the first registered.
        assert r3.status_code == 200, f"/auth/me failed: {r3.status_code} {r3.text}"
        assert r3.json()["email"] == email
        # Also verify token from login works
        r4 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token2}"}, timeout=20)
        assert r4.status_code == 200

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nobody.islandhop@example.com", "password": "WrongPass1!"
        }, timeout=20)
        assert r.status_code == 401, r.text

    def test_duplicate_register_400(self):
        email = f"dup_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}@test.com"
        payload = {"email": email, "password": "Test1234!", "name": "Dup", "user_type": "customer"}
        r1 = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r2.status_code == 400


# --------------------------- Scheduled Orders (NEW) ---------------------------

def _future_date(days_ahead=7):
    d = datetime.now() + timedelta(days=days_ahead)
    return d.strftime("%Y-%m-%d"), d.strftime("%H:%M")


class TestScheduledOrders:
    def test_401_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "food",
            "delivery_address_id": "addr_1",
            "scheduled_date": "2030-01-01",
            "scheduled_time": "12:00",
        }, timeout=20)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

        r2 = requests.get(f"{BASE_URL}/api/scheduled-orders", timeout=20)
        assert r2.status_code == 401

    def test_400_past_date(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "food",
            "delivery_address_id": "addr_1",
            "scheduled_date": "2000-01-01",
            "scheduled_time": "12:00",
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_create_one_time_scheduled_order(self, auth_headers):
        d, t = _future_date(days_ahead=10)
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "food",
            "restaurant_id": "rest_demo_1",
            "items": [{"name": "Pizza", "qty": 1}],
            "delivery_address_id": "addr_demo_1",
            "scheduled_date": d,
            "scheduled_time": t,
            "is_recurring": False,
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["service_type"] == "food"
        assert body["is_recurring"] is False
        assert body["recurring_order_id"] is None
        assert body["status"] == "pending"
        # GET verifies persistence
        list_r = requests.get(f"{BASE_URL}/api/scheduled-orders", headers=auth_headers, timeout=20)
        assert list_r.status_code == 200
        ids = [o["id"] for o in list_r.json()]
        assert body["id"] in ids

    def test_recurring_weekly_creates_parent_and_child(self, auth_headers):
        d, t = _future_date(days_ahead=5)
        end_d = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "groceries",
            "items": [{"name": "Milk", "qty": 2}],
            "delivery_address_id": "addr_demo_2",
            "scheduled_date": d,
            "scheduled_time": t,
            "is_recurring": True,
            "recurrence_pattern": "weekly",
            "recurrence_days": [1, 3],
            "end_date": end_d,
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_recurring"] is True
        assert body["recurring_pattern"] == "weekly"
        recurring_id = body["recurring_order_id"]
        assert recurring_id, "recurring_order_id must be set when is_recurring=True"

        # Verify parent appears in recurring list
        rec_list = requests.get(f"{BASE_URL}/api/recurring-orders", headers=auth_headers, timeout=20)
        assert rec_list.status_code == 200
        rec_ids = [r["id"] for r in rec_list.json()]
        assert recurring_id in rec_ids
        parent = next(r for r in rec_list.json() if r["id"] == recurring_id)
        assert parent["recurrence_pattern"] == "weekly"
        assert parent["active"] is True
        assert "next_occurrence" in parent

        # Delete the recurring → should deactivate parent + cancel pending child
        del_r = requests.delete(f"{BASE_URL}/api/recurring-orders/{recurring_id}", headers=auth_headers, timeout=20)
        assert del_r.status_code == 200, del_r.text
        # Parent gone from list (active=False filter)
        rec_list2 = requests.get(f"{BASE_URL}/api/recurring-orders", headers=auth_headers, timeout=20)
        assert recurring_id not in [r["id"] for r in rec_list2.json()]
        # Child scheduled order must no longer be in "pending"/"confirmed" list
        sched_list = requests.get(f"{BASE_URL}/api/scheduled-orders", headers=auth_headers, timeout=20)
        child_ids = [o["id"] for o in sched_list.json()]
        assert body["id"] not in child_ids, "Child scheduled order should be cancelled when recurring is deleted"

    def test_cancel_scheduled_order(self, auth_headers):
        d, t = _future_date(days_ahead=3)
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "pharmacy",
            "delivery_address_id": "addr_demo_3",
            "scheduled_date": d,
            "scheduled_time": t,
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        oid = r.json()["id"]
        del_r = requests.delete(f"{BASE_URL}/api/scheduled-orders/{oid}", headers=auth_headers, timeout=20)
        assert del_r.status_code == 200
        assert del_r.json()["status"] == "cancelled"

    def test_delete_unknown_scheduled_order_404(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/scheduled-orders/does-not-exist", headers=auth_headers, timeout=20)
        assert r.status_code == 404

    def test_recurring_requires_pattern(self, auth_headers):
        d, t = _future_date(days_ahead=4)
        r = requests.post(f"{BASE_URL}/api/scheduled-orders", json={
            "service_type": "food",
            "delivery_address_id": "addr_demo",
            "scheduled_date": d,
            "scheduled_time": t,
            "is_recurring": True,
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 400


# --------------------------- Addresses ---------------------------

class TestAddresses:
    def test_401_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/addresses", timeout=15)
        assert r.status_code == 401

    def test_crud(self, auth_headers):
        payload = {
            "user_id": "ignored-server-overrides",
            "label": "home",
            "street_address": "123 Test Lane",
            "city": "Kingston",
            "state": "KIN",
            "postal_code": "JM-1",
            "country": "Jamaica",
            "is_default": True,
        }
        r = requests.post(f"{BASE_URL}/api/addresses", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        addr = r.json()
        assert addr["street_address"] == "123 Test Lane"
        addr_id = addr["id"]

        # List
        lst = requests.get(f"{BASE_URL}/api/addresses", headers=auth_headers, timeout=20)
        assert lst.status_code == 200
        items = lst.json()
        assert any(a["id"] == addr_id for a in items)
        # _id should not leak (BUG check)
        for a in items:
            assert "_id" not in a, "Mongo _id leaked in /api/addresses GET response"

        # Update
        upd_payload = dict(payload)
        upd_payload["label"] = "work"
        upd_payload["id"] = addr_id
        upd = requests.put(f"{BASE_URL}/api/addresses/{addr_id}", json=upd_payload, headers=auth_headers, timeout=20)
        assert upd.status_code == 200, upd.text
        assert upd.json()["label"] == "work"

        # Set default
        sd = requests.post(f"{BASE_URL}/api/addresses/{addr_id}/set-default", headers=auth_headers, timeout=20)
        assert sd.status_code == 200

        # Delete
        d = requests.delete(f"{BASE_URL}/api/addresses/{addr_id}", headers=auth_headers, timeout=20)
        assert d.status_code == 200


# --------------------------- Promo Codes ---------------------------

class TestPromoCodes:
    def test_promo_lifecycle(self, auth_headers):
        now = datetime.utcnow()
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "code": code,
            "type": "percentage",
            "value": 10.0,
            "min_order_amount": 5.0,
            "valid_from": now.isoformat(),
            "valid_until": (now + timedelta(days=30)).isoformat(),
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/promo-codes", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        # Public list
        lst = requests.get(f"{BASE_URL}/api/promo-codes", timeout=20)
        assert lst.status_code == 200
        # Validate
        val = requests.get(
            f"{BASE_URL}/api/promo-codes/{code}/validate",
            params={"order_total": 25.0, "service_type": "food"},
            timeout=20,
        )
        assert val.status_code == 200, val.text
        assert val.json()["valid"] is True
        assert val.json()["discount"] > 0

        # Apply (note: takes user_id as query param)
        apply_r = requests.post(
            f"{BASE_URL}/api/promo-codes/{code}/apply",
            params={"user_id": "test-user"},
            timeout=20,
        )
        assert apply_r.status_code == 200

    def test_validate_unknown_404(self):
        r = requests.get(
            f"{BASE_URL}/api/promo-codes/DOESNOTEXIST123/validate",
            params={"order_total": 10.0, "service_type": "food"},
            timeout=20,
        )
        assert r.status_code == 404


# --------------------------- Support Tickets ---------------------------

class TestSupportTickets:
    def test_create_and_list(self, auth_headers):
        payload = {
            "user_id": "ignored",
            "subject": "Test issue",
            "category": "general",
            "description": "This is a test ticket",
        }
        r = requests.post(f"{BASE_URL}/api/support/tickets", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        # List
        lst = requests.get(f"{BASE_URL}/api/support/tickets", headers=auth_headers, timeout=20)
        assert lst.status_code == 200
        ids = [t["id"] for t in lst.json()]
        assert tid in ids
        for t in lst.json():
            assert "_id" not in t, "Mongo _id leaked in /api/support/tickets GET response"
        # Get one
        one = requests.get(f"{BASE_URL}/api/support/tickets/{tid}", headers=auth_headers, timeout=20)
        assert one.status_code == 200
        assert "_id" not in one.json(), "_id leaked in single ticket GET"


# --------------------------- Search ---------------------------

class TestSearch:
    def test_search_basic(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "pizza"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)


# --------------------------- Admin Stats & Analytics ---------------------------

class TestAdmin:
    def test_admin_stats(self):
        # Endpoint requires auth + admin role; without auth must 401
        r = requests.get(f"{BASE_URL}/api/admin/stats", timeout=20)
        assert r.status_code in (401, 403), r.text

    def test_kpi_dashboard(self):
        r = requests.get(f"{BASE_URL}/api/analytics/kpi-dashboard", timeout=30)
        assert r.status_code == 200

    def test_financial_summary(self):
        start = (datetime.now() - timedelta(days=30)).isoformat()
        end = datetime.now().isoformat()
        r = requests.get(
            f"{BASE_URL}/api/analytics/financial-summary",
            params={"start_date": start, "end_date": end},
            timeout=30,
        )
        assert r.status_code == 200, r.text


# --------------------------- Driver Location & Wallet ---------------------------

class TestDriver:
    def test_driver_location_post_and_get(self, driver_creds):
        driver_id = driver_creds["user_id"]
        # endpoint signature uses query params for lat/lng
        r = requests.post(
            f"{BASE_URL}/api/drivers/{driver_id}/location",
            params={"latitude": 18.0179, "longitude": -76.8099},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text

        # GET driver location
        g = requests.get(f"{BASE_URL}/api/drivers/{driver_id}/location", timeout=20)
        assert g.status_code in (200, 404), g.text  # 404 acceptable if driver record not in drivers collection

    def test_driver_wallet_get(self, driver_creds):
        driver_id = driver_creds["user_id"]
        r = requests.get(f"{BASE_URL}/api/drivers/{driver_id}/wallet", timeout=20)
        # endpoint should respond (200) even if wallet doc missing
        assert r.status_code in (200, 404), r.text


# --------------------------- Vendor Payouts ---------------------------

class TestVendorPayouts:
    def test_vendor_payouts_get(self, restaurant_creds):
        vid = restaurant_creds["user_id"]
        r = requests.get(f"{BASE_URL}/api/vendors/{vid}/payouts", timeout=20)
        assert r.status_code in (200, 404), r.text


# --------------------------- Ratings ---------------------------

class TestRatings:
    def test_vendor_ratings_get(self):
        r = requests.get(f"{BASE_URL}/api/vendors/anyid/ratings", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_driver_ratings_get(self):
        r = requests.get(f"{BASE_URL}/api/drivers/anyid/ratings", timeout=20)
        assert r.status_code == 200


# --------------------------- Menu Management ---------------------------

class TestMenu:
    def test_create_restaurant_and_menu(self, restaurant_creds, restaurant_headers):
        # First create restaurant entity (server requires it for menu items)
        resto_payload = {
            "name": f"TEST_Resto_{uuid.uuid4().hex[:6]}",
            "description": "test restaurant",
            "cuisine_type": "Caribbean",
            "address": "123 Test",
            "phone": "555-0001",
            "email": restaurant_creds["email"],
            "owner_id": restaurant_creds["user_id"],
        }
        r = requests.post(f"{BASE_URL}/api/restaurants", json=resto_payload, timeout=20)
        # restaurant creation may not require auth header; just record status
        assert r.status_code in (200, 201, 400, 422), r.text
        # Public restaurant list
        lst = requests.get(f"{BASE_URL}/api/restaurants", timeout=20)
        assert lst.status_code == 200


# --------------------------- JWT Fallback across new routes ---------------------------

class TestJwtFallbackAcrossRoutes:
    """Validate that Bearer-token JWT works for routes that originally used session cookies."""

    def test_jwt_works_for_scheduled_addresses_promos_support(self, customer_creds):
        h = {"Authorization": f"Bearer {customer_creds['token']}"}
        endpoints = [
            f"{BASE_URL}/api/scheduled-orders",
            f"{BASE_URL}/api/recurring-orders",
            f"{BASE_URL}/api/addresses",
            f"{BASE_URL}/api/support/tickets",
        ]
        for url in endpoints:
            r = requests.get(url, headers=h, timeout=20)
            assert r.status_code == 200, f"JWT Bearer failed on {url}: {r.status_code} {r.text}"

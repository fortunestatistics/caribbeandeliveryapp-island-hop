"""Iteration 25 — Admin User Profile dialog + COD cash reconciliation backend tests."""
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASSWORD = "AdminQA1234!"


# --- helpers ---------------------------------------------------------------

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def customer():
    ts = int(time.time())
    email = f"TEST_iter25_cust_{ts}@gmail.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Iter25 Cust", "user_type": "customer"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return {"id": j["user"]["id"], "email": email, "token": j["access_token"]}


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _create_cod_order(customer_tok, total_target=50.0):
    payload = {
        "customer_id": "ignored-by-server",
        "service_type": "food",
        "items": [{"id": str(uuid.uuid4()), "menu_item_id": "mi-1", "name": "Burger", "price": 40.0, "quantity": 1}],
        "subtotal": 40.0,
        "delivery_fee": 5.0,
        "tip": 0.0,
        "total": 0,  # server recomputes
        "pickup_address": {"address": "Pickup", "latitude": 10.65, "longitude": -61.51},
        "delivery_address": {"address": "Drop", "latitude": 10.66, "longitude": -61.52},
        "customer_phone": "+18685551234",
        "payment_method": "card",
    }
    r = requests.post(f"{API}/orders", json=payload, headers=_h(customer_tok), timeout=30)
    assert r.status_code == 200, r.text
    order = r.json()
    r2 = requests.post(f"{API}/orders/{order['id']}/confirm-cod", headers=_h(customer_tok), timeout=30)
    assert r2.status_code == 200, r2.text
    return r2.json().get("order_id") or order["id"]


# --- Tests: Admin profile endpoint -----------------------------------------

class TestAdminUserProfile:
    def test_profile_admin_ok(self, admin_token, customer):
        r = requests.get(f"{API}/admin/users/{customer['id']}/profile", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for key in ("user", "stats", "recent_orders", "role_record", "referrer"):
            assert key in body, f"missing {key}"
        assert "password" not in body["user"]
        assert "_id" not in body["user"]
        assert body["user"]["email"] == customer["email"]
        for k in ("order_count", "total_spent", "delivered", "active"):
            assert k in body["stats"]
        assert isinstance(body["recent_orders"], list)

    def test_profile_nonadmin_403(self, customer):
        r = requests.get(f"{API}/admin/users/{customer['id']}/profile", headers=_h(customer["token"]), timeout=30)
        assert r.status_code == 403

    def test_profile_unknown_404(self, admin_token):
        r = requests.get(f"{API}/admin/users/does-not-exist-xyz/profile", headers=_h(admin_token), timeout=30)
        assert r.status_code == 404

    def test_profile_stats_after_order(self, admin_token, customer):
        order_id = _create_cod_order(customer["token"])
        r = requests.get(f"{API}/admin/users/{customer['id']}/profile", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["stats"]["order_count"] >= 1
        ids = [o["id"] for o in body["recent_orders"]]
        assert order_id in ids


# --- Tests: COD cash flow --------------------------------------------------

class TestCODCashFlow:
    def test_cash_collected_as_admin(self, admin_token, customer, mongo):
        order_id = _create_cod_order(customer["token"])
        # Attach a fake driver to the order so platform_due math has a non-zero driver_earnings if any.
        driver_id = f"TEST_drv_{int(time.time())}"
        user_id = f"TEST_drv_user_{int(time.time())}"
        mongo.drivers.insert_one({"id": driver_id, "user_id": user_id, "status": "online", "cash_outstanding": 0.0})
        mongo.orders.update_one({"id": order_id}, {"$set": {"driver_id": driver_id}})

        r = requests.post(f"{API}/orders/{order_id}/cash-collected", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["order_id"] == order_id
        # platform_due = total - driver_earnings
        assert body["platform_due"] == round(body["cash_total"] - body["driver_keeps"], 2)

        # Idempotency: second call -> 400
        r2 = requests.post(f"{API}/orders/{order_id}/cash-collected", headers=_h(admin_token), timeout=30)
        assert r2.status_code == 400

        # Verify persistence on order via Mongo (GET /orders/{id} doesn't allow admin in this MVP)
        order_doc = mongo.orders.find_one({"id": order_id}, {"_id": 0, "payment_status": 1})
        assert order_doc and order_doc.get("payment_status") == "cod_collected"

        # cash-outstanding lists driver
        r4 = requests.get(f"{API}/admin/drivers/cash-outstanding", headers=_h(admin_token), timeout=30)
        assert r4.status_code == 200
        drivers = r4.json()["drivers"]
        assert any(d["driver_id"] == driver_id for d in drivers)

        # Settle resets it
        r5 = requests.post(f"{API}/admin/drivers/{driver_id}/settle-cash", headers=_h(admin_token), timeout=30)
        assert r5.status_code == 200
        assert r5.json()["success"] is True

        # cleanup
        mongo.drivers.delete_one({"id": driver_id})

    def test_cash_collected_unrelated_user_403(self, customer, mongo):
        order_id = _create_cod_order(customer["token"])
        # Create another customer
        ts = int(time.time())
        email = f"TEST_iter25_other_{ts}@gmail.com"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Test1234!", "name": "Other", "user_type": "customer"},
            timeout=30,
        )
        assert r.status_code == 200
        other = r.json()["access_token"]
        r2 = requests.post(f"{API}/orders/{order_id}/cash-collected", headers=_h(other), timeout=30)
        assert r2.status_code == 403

    def test_cash_outstanding_requires_admin(self, customer):
        r = requests.get(f"{API}/admin/drivers/cash-outstanding", headers=_h(customer["token"]), timeout=30)
        assert r.status_code == 403

    def test_settle_cash_requires_admin(self, customer):
        r = requests.post(f"{API}/admin/drivers/any-driver-id/settle-cash", headers=_h(customer["token"]), timeout=30)
        assert r.status_code == 403

    def test_settle_unknown_driver_404(self, admin_token):
        r = requests.post(f"{API}/admin/drivers/does-not-exist-zzz/settle-cash", headers=_h(admin_token), timeout=30)
        assert r.status_code == 404

    def test_cash_collected_non_cod_400(self, admin_token, customer, mongo):
        # Create order but DON'T confirm-cod. payment_method will not be 'cash'.
        payload = {
            "customer_id": "x",
            "service_type": "food",
            "items": [{"id": str(uuid.uuid4()), "menu_item_id": "mi-2", "name": "X", "price": 10.0, "quantity": 1}],
            "subtotal": 10.0, "delivery_fee": 5.0, "tip": 0.0, "total": 0,
            "pickup_address": {"address": "A", "latitude": 10.0, "longitude": -61.0},
            "delivery_address": {"address": "B", "latitude": 10.1, "longitude": -61.1},
            "customer_phone": "+18685551234", "payment_method": "card",
        }
        r = requests.post(f"{API}/orders", json=payload, headers=_h(customer["token"]), timeout=30)
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = requests.post(f"{API}/orders/{oid}/cash-collected", headers=_h(admin_token), timeout=30)
        assert r2.status_code == 400

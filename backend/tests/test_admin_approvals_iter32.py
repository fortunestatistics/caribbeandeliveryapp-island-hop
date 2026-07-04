"""Iteration 32 - Admin Approvals section + promo-rewards endpoint tests.

Covers:
 - GET /api/admin/records/{category} for all 5 categories (auth 403, admin 200, structure)
 - GET /api/admin/records/{category}/{id}/orders returns type='order' or 'rental'
 - Sensitive-field scrubbing on users category
 - GET /api/admin/promo-rewards structure
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASSWORD = "AdminQA1234!"

CATEGORIES = ["restaurants", "drivers", "car_rentals", "businesses", "users"]
SENSITIVE = ("hashed_password", "password", "session_token")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def customer_token():
    email = f"qa_iter32_{int(time.time())}@gmail.com"
    requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "QA32", "user_type": "customer"
    }, timeout=20)
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"}, timeout=20)
    return r.json().get("access_token") if r.status_code == 200 else None


def h(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth guard ---
def test_records_requires_auth():
    r = requests.get(f"{API}/admin/records/restaurants", timeout=20)
    assert r.status_code in (401, 403), r.text


def test_records_forbidden_for_customer(customer_token):
    if not customer_token:
        pytest.skip("no customer token")
    r = requests.get(f"{API}/admin/records/restaurants", headers=h(customer_token), timeout=20)
    assert r.status_code == 403


def test_promo_rewards_requires_auth():
    r = requests.get(f"{API}/admin/promo-rewards", timeout=20)
    assert r.status_code in (401, 403)


# --- Category list endpoint ---
@pytest.mark.parametrize("cat", CATEGORIES)
def test_records_category_ok(admin_token, cat):
    r = requests.get(f"{API}/admin/records/{cat}?limit=50", headers=h(admin_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["category"] == cat
    assert "count" in data and isinstance(data["records"], list)
    assert data["count"] == len(data["records"])
    if data["records"]:
        rec = data["records"][0]
        # each record row must carry the curated fields + a `full` blob
        for key in ("id", "status", "full"):
            assert key in rec, f"missing {key} in {cat} record"
        assert isinstance(rec["full"], dict)


def test_records_unknown_category(admin_token):
    r = requests.get(f"{API}/admin/records/wat", headers=h(admin_token), timeout=20)
    assert r.status_code == 404


def test_users_category_scrubs_sensitive_fields(admin_token):
    r = requests.get(f"{API}/admin/records/users?limit=100", headers=h(admin_token), timeout=30)
    assert r.status_code == 200
    for rec in r.json()["records"]:
        full = rec.get("full") or {}
        for f in SENSITIVE:
            assert f not in full, f"sensitive field {f} exposed in users.full"
        # Also ensure not present at top level of row
        for f in SENSITIVE:
            assert f not in rec, f"sensitive field {f} exposed at row root"


# --- Order history endpoint ---
def test_orders_for_a_record(admin_token):
    # Pick a category that likely has records - drivers has ~157 per context
    r = requests.get(f"{API}/admin/records/drivers?limit=5", headers=h(admin_token), timeout=30)
    assert r.status_code == 200
    recs = r.json()["records"]
    if not recs:
        pytest.skip("no driver records to fetch orders for")
    rid = recs[0]["id"]
    r2 = requests.get(f"{API}/admin/records/drivers/{rid}/orders",
                      headers=h(admin_token), timeout=30)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["type"] == "order"
    assert "orders" in data and isinstance(data["orders"], list)
    assert data["count"] == len(data["orders"])


def test_orders_for_car_rental_returns_rental_type(admin_token):
    r = requests.get(f"{API}/admin/records/car_rentals?limit=5", headers=h(admin_token), timeout=30)
    assert r.status_code == 200
    recs = r.json()["records"]
    if not recs:
        pytest.skip("no car_rentals")
    rid = recs[0]["id"]
    r2 = requests.get(f"{API}/admin/records/car_rentals/{rid}/orders",
                      headers=h(admin_token), timeout=30)
    assert r2.status_code == 200
    data = r2.json()
    assert data["type"] == "rental"
    assert isinstance(data["orders"], list)


def test_orders_endpoint_requires_admin(customer_token, admin_token):
    if not customer_token:
        pytest.skip("no customer")
    # get a valid record id first
    recs = requests.get(f"{API}/admin/records/users?limit=1", headers=h(admin_token), timeout=20).json()["records"]
    if not recs:
        pytest.skip("no user records")
    rid = recs[0]["id"]
    r = requests.get(f"{API}/admin/records/users/{rid}/orders",
                     headers=h(customer_token), timeout=20)
    assert r.status_code == 403


# --- Promo rewards ledger ---
def test_promo_rewards_admin(admin_token):
    r = requests.get(f"{API}/admin/promo-rewards", headers=h(admin_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("rewards", "counts", "currency", "reward_schedule"):
        assert key in data, f"missing {key}"
    for st in ("pending_first_order", "held", "paid"):
        assert st in data["counts"], f"missing counts.{st}"
        assert isinstance(data["counts"][st], int)
    assert isinstance(data["rewards"], list)

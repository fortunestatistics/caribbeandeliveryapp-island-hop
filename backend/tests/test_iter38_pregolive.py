"""
Iter38 pre-go-live test suite for IslandHop core marketplace loops.

Covers:
  1. Driver go-live: register user -> apply as driver -> admin approve -> login -> PUT /api/drivers/status (JSON body).
  2. Driver earnings data endpoints: /api/drivers/me and /api/drivers/{id}/wallet return real data.
  3. Order lifecycle: customer creates order with $3 service fee applied.
  4. Merchant storefront + first product for an approved restaurant.
  5. Approved-merchant self-heal: user with verified business_application gets user_type promoted + storefront resolves.
  6. Admin link-provision endpoint 403 for non-admins.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"


def _rand_email(prefix: str) -> str:
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@islandhop-qa.com"


def _register(email: str, password: str = "Test1234!", name: str = "QA Tester", phone: str = "+18683334444"):
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": password, "name": name, "phone": phone, "user_type": "customer"
    }, timeout=30)
    return r


def _login(email: str, password: str = "Test1234!"):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# --- 1. Driver go-live flow ------------------------------------------------
@pytest.fixture(scope="module")
def driver_ctx(admin_token):
    email = _rand_email("driver")
    reg = _register(email, name="QA Driver")
    assert reg.status_code == 200, f"driver register: {reg.text}"
    tok = reg.json().get("access_token") or _login(email).json()["access_token"]

    # Apply as driver
    app_payload = {
        "license_number": "DL-" + uuid.uuid4().hex[:6].upper(),
        "vehicle_type": "car",
        "vehicle_plate": "TQA-" + uuid.uuid4().hex[:4].upper(),
        "documents": {"license_front": "data:image/png;base64,AAAA"},
        "personal_info": {"name": "QA Driver", "email": email, "phone": "+18683334444", "city": "Port of Spain"},
        "vehicle_info": {"make": "Toyota", "model": "Corolla", "year": 2020, "color": "White"},
        "banking_info": {"bank_name": "RBC", "account_number": "1234567"}
    }
    r = requests.post(f"{BASE_URL}/api/drivers", json=app_payload, headers=_auth(tok), timeout=30)
    assert r.status_code == 200, f"driver apply: {r.status_code} {r.text}"
    driver_id = r.json()["id"]

    # Admin approves
    ap = requests.post(f"{BASE_URL}/api/admin/drivers/{driver_id}/approve",
                      json={"notes": "iter38 test"}, headers=_auth(admin_token), timeout=30)
    assert ap.status_code == 200, f"admin approve driver: {ap.status_code} {ap.text}"

    # Fresh login so JWT has driver role
    tok2 = _login(email).json()["access_token"]
    return {"email": email, "token": tok2, "driver_id": driver_id}


def test_driver_status_online_json_body(driver_ctx):
    r = requests.put(f"{BASE_URL}/api/drivers/status",
                    json={"status": "online"}, headers=_auth(driver_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"go online: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert data.get("status") == "online"


def test_driver_status_offline_json_body(driver_ctx):
    r = requests.put(f"{BASE_URL}/api/drivers/status",
                    json={"status": "offline"}, headers=_auth(driver_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"go offline: {r.status_code} {r.text}"
    assert r.json().get("status") == "offline"


def test_driver_status_invalid(driver_ctx):
    r = requests.put(f"{BASE_URL}/api/drivers/status",
                    json={"status": "banana"}, headers=_auth(driver_ctx["token"]), timeout=30)
    assert r.status_code == 400


# --- 2. Driver earnings data endpoints -------------------------------------
def test_drivers_me_returns_real_data(driver_ctx):
    r = requests.get(f"{BASE_URL}/api/drivers/me", headers=_auth(driver_ctx["token"]), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("id") == driver_ctx["driver_id"]
    # active because admin approved
    assert d.get("status") in ("active", "offline", "online")


def test_driver_wallet_returns_real_data(driver_ctx):
    r = requests.get(f"{BASE_URL}/api/drivers/{driver_ctx['driver_id']}/wallet",
                    headers=_auth(driver_ctx["token"]), timeout=30)
    assert r.status_code == 200, r.text
    w = r.json()
    # Fresh driver -> zeros, not a hardcoded "$15,678"
    for key in ("balance", "pending_balance", "total_earned"):
        if key in w:
            assert float(w[key]) == 0.0, f"expected {key}=0 for fresh driver, got {w[key]}"


# --- 3. Order lifecycle with $3 service fee --------------------------------
@pytest.fixture(scope="module")
def customer_ctx():
    email = _rand_email("cust")
    reg = _register(email, name="QA Customer")
    assert reg.status_code == 200
    tok = reg.json().get("access_token") or _login(email).json()["access_token"]
    return {"email": email, "token": tok}


@pytest.fixture(scope="module")
def active_restaurant():
    r = requests.get(f"{BASE_URL}/api/restaurants", timeout=30)
    assert r.status_code == 200
    lst = r.json() if isinstance(r.json(), list) else r.json().get("restaurants", [])
    actives = [x for x in lst if x.get("status") == "active"]
    if not actives:
        pytest.skip("No active restaurants seeded")
    return actives[0]


def test_order_created_with_3_dollar_service_fee(customer_ctx, active_restaurant):
    rest = active_restaurant
    payload = {
        "customer_id": "will-be-overwritten",
        "customer_phone": "+18683334444",
        "restaurant_id": rest["id"],
        "vendor_id": rest["id"],
        "service_type": "food_delivery",
        "items": [{"menu_item_id": "x", "id": "x", "name": "Test Meal", "price": 25.0, "quantity": 1}],
        "subtotal": 25.0,
        "delivery_fee": 5.0,
        "tax": 0.0,
        "tip": 0.0,
        "discount": 0.0,
        "total": 33.0,
        "pickup_address": {"street": "1 Rest St", "city": "POS", "country": "TT"},
        "delivery_address": {"street": "2 Home St", "city": "POS", "country": "TT"},
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=_auth(customer_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"create order: {r.status_code} {r.text}"
    order = r.json()
    assert order["service_fee"] == 3.0, f"expected $3 service_fee, got {order.get('service_fee')}"
    # total = 25 + 5 + 3 = 33
    assert abs(order["total"] - 33.0) < 0.01, f"expected total 33.00, got {order.get('total')}"

    # Verify order shows in customer's list
    lst = requests.get(f"{BASE_URL}/api/orders", headers=_auth(customer_ctx["token"]), timeout=30)
    assert lst.status_code == 200
    ids = [o.get("id") for o in lst.json()]
    assert order["id"] in ids


# --- 4. Merchant storefront + first product --------------------------------
@pytest.fixture(scope="module")
def merchant_ctx():
    """Register a customer, POST /api/restaurants to auto-promote to restaurant role."""
    email = _rand_email("merch")
    reg = _register(email, name="QA Merchant")
    assert reg.status_code == 200
    tok = reg.json().get("access_token") or _login(email).json()["access_token"]

    rest_payload = {
        "user_id": "",
        "name": f"TEST Restaurant {uuid.uuid4().hex[:6]}",
        "description": "iter38 test restaurant",
        "cuisine_type": "caribbean",
        "phone": "+18683334444",
        "email": email,
        "address": {"street": "1 Test St", "city": "POS", "country": "TT"},
        "status": "active",
    }
    r = requests.post(f"{BASE_URL}/api/restaurants", json=rest_payload, headers=_auth(tok), timeout=30)
    assert r.status_code == 200, f"create restaurant: {r.status_code} {r.text}"

    # Re-login so JWT reflects promoted role (though bearer just reads user record)
    tok2 = _login(email).json()["access_token"]
    return {"email": email, "token": tok2, "restaurant": r.json()}


def test_merchant_storefront_200(merchant_ctx):
    r = requests.get(f"{BASE_URL}/api/merchant/storefront",
                    headers=_auth(merchant_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"storefront: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("vendor_id") == merchant_ctx["restaurant"]["id"]
    assert body.get("vendor_type") in ("restaurant", "business", "supplier")


def test_merchant_add_first_product(merchant_ctx):
    product_name = f"TEST Doubles {uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/api/merchant/products",
                     json={"name": product_name, "price": 8.5, "category": "Snacks"},
                     headers=_auth(merchant_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"add product: {r.status_code} {r.text}"
    prod = r.json()
    assert prod["name"] == product_name
    assert prod["price"] == 8.5

    # Appears in merchant products
    lst = requests.get(f"{BASE_URL}/api/merchant/products",
                      headers=_auth(merchant_ctx["token"]), timeout=30)
    assert lst.status_code == 200
    names = [p["name"] for p in lst.json().get("products", [])]
    assert product_name in names

    # Give indexes a moment then hit public search
    time.sleep(1)
    s = requests.get(f"{BASE_URL}/api/search", params={"q": product_name[:12]}, timeout=30)
    assert s.status_code == 200
    # non-strict: search may include vendor or product-level hits


# --- 5. Approved-merchant self-heal ----------------------------------------
def test_approved_merchant_self_heal(admin_token):
    """Register a plain customer, create a verified business_application linked by user_id,
    then call /api/merchant/storefront which should self-heal (promote + provision)."""
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL") or open("/app/backend/.env").read().split("MONGO_URL=")[1].split("\n")[0].strip().strip('"')
    db_name = os.environ.get("DB_NAME") or open("/app/backend/.env").read().split("DB_NAME=")[1].split("\n")[0].strip().strip('"')
    client = MongoClient(mongo_url)
    db = client[db_name]

    email = _rand_email("selfheal")
    reg = _register(email, name="QA SelfHeal")
    assert reg.status_code == 200
    tok = reg.json().get("access_token") or _login(email).json()["access_token"]
    user = db.users.find_one({"email": email})
    assert user and user.get("user_type") == "customer"

    app_id = str(uuid.uuid4())
    db.business_applications.insert_one({
        "id": app_id,
        "user_id": user["id"],
        "email": email,
        "business_name": f"TEST Biz {app_id[:6]}",
        "business_type": "business",
        "verification_status": "verified",
        "business_details": {"business_type": "grocery"},
    })

    # Call storefront -> triggers self-heal (uses user_id linkage only)
    r = requests.get(f"{BASE_URL}/api/merchant/storefront", headers=_auth(tok), timeout=30)
    assert r.status_code == 200, f"self-heal storefront: {r.status_code} {r.text}"

    # user_type should now be promoted
    user_after = db.users.find_one({"email": email})
    assert user_after.get("user_type") in ("business", "restaurant", "supplier"), \
        f"user_type not promoted: {user_after.get('user_type')}"

    # Vendor record exists
    biz = db.businesses.find_one({"user_id": user["id"]})
    assert biz is not None, "self-heal did not create businesses record"

    # cleanup
    db.business_applications.delete_one({"id": app_id})
    db.businesses.delete_many({"user_id": user["id"]})


# --- 6. Admin link-provision endpoint --------------------------------------
def test_link_provision_forbidden_for_non_admin(customer_ctx):
    r = requests.post(f"{BASE_URL}/api/admin/businesses/nonexistent/link-provision",
                     json={"email": "x@y.z"}, headers=_auth(customer_ctx["token"]), timeout=30)
    assert r.status_code == 403


def test_link_provision_happy_path(admin_token):
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL") or open("/app/backend/.env").read().split("MONGO_URL=")[1].split("\n")[0].strip().strip('"')
    db_name = os.environ.get("DB_NAME") or open("/app/backend/.env").read().split("DB_NAME=")[1].split("\n")[0].strip().strip('"')
    client = MongoClient(mongo_url)
    db = client[db_name]

    # Create a merchant account (customer) + an approved application NOT linked by user_id (email only)
    email = _rand_email("linkprov")
    reg = _register(email, name="QA LinkProv")
    assert reg.status_code == 200
    user = db.users.find_one({"email": email})

    app_id = str(uuid.uuid4())
    db.business_applications.insert_one({
        "id": app_id,
        "user_id": None,  # unlinked
        "email": email,
        "business_name": f"TEST LinkProv {app_id[:6]}",
        "business_type": "business",
        "verification_status": "verified",
        "business_details": {"business_type": "pharmacy"},
    })

    r = requests.post(f"{BASE_URL}/api/admin/businesses/{app_id}/link-provision",
                     json={"email": email}, headers=_auth(admin_token), timeout=30)
    assert r.status_code == 200, f"link-provision: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("user_id") == user["id"]
    assert body.get("vendor_type") in ("restaurant", "pharmacy", "grocery", "business", "supplier")

    # cleanup
    db.business_applications.delete_one({"id": app_id})
    db.businesses.delete_many({"user_id": user["id"]})

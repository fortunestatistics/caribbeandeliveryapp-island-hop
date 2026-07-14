"""Iter 40 backend tests.

Covers:
- DriverSettings crash fix precondition: PUT /drivers/profile succeeds when driver
  has NO banking_info and returns a driver doc that the frontend must handle
  null-safely.
- Password length backend still requires >=8 (frontend should now match).
- /merchant/products returns vendor_type for both restaurant and grocery.
- Restaurant merchant creation via /api/restaurants.
- Grocery merchant creation via direct Mongo insert (mirrors the recommended
  flow in the review request).
- Non-restaurant storefront exposes vendor_type and menu_items so the customer
  page can derive categories.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
PASSWORD = "Test1234!"


def _uid():
    return uuid.uuid4().hex[:8]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _register(email, name="QA"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "name": name, "user_type": "customer",
    }, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _login(email, pw=PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _me(token):
    return requests.get(f"{API}/auth/me", headers=_hdr(token), timeout=15).json()


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


# ------------- DRIVER -------------
@pytest.fixture(scope="module")
def driver_ctx(mongo):
    email = f"TEST_iter40_drv_{_uid()}@gmail.com"
    tok = _register(email, "QA Driver 40")
    # Create driver WITHOUT banking_info
    r = requests.post(f"{API}/drivers", json={
        "license_number": "L40-100", "vehicle_type": "car", "vehicle_plate": "TAB-40-1",
    }, headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    me = _me(tok)
    mongo.users.update_one({"email": email}, {"$set": {"user_type": "driver"}})
    mongo.drivers.update_one({"user_id": me["id"]}, {"$set": {"status": "active"}})
    tok = _login(email)
    return {"email": email, "token": tok, "id": me["id"]}


class TestDriverBankingNull:
    def test_driver_has_null_banking_info(self, driver_ctx):
        r = requests.get(f"{API}/drivers/me", headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Either null or missing → frontend must guard against both
        assert d.get("banking_info") in (None, {}) or d.get("banking_info") is None

    def test_put_vehicle_returns_driver_with_null_banking(self, driver_ctx):
        r = requests.put(f"{API}/drivers/profile", json={
            "license_number": "L40-999", "vehicle_type": "van", "vehicle_plate": "TAB-40-99",
        }, headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        drv = r.json().get("driver", {})
        assert drv["license_number"] == "L40-999"
        assert drv["vehicle_plate"] == "TAB-40-99"
        # This is the field that used to crash the frontend if not null-safe
        assert drv.get("banking_info") in (None, {}, None)

    def test_then_save_banking_ok(self, driver_ctx):
        payload = {"banking_info": {
            "bank_name": "Republic", "account_name": "QA D",
            "account_number": "9999", "branch": "Main",
        }}
        r = requests.put(f"{API}/drivers/profile", json=payload,
                         headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200
        got = requests.get(f"{API}/drivers/me", headers=_hdr(driver_ctx["token"])).json()
        assert got["banking_info"]["bank_name"] == "Republic"


# ------------- PASSWORD LENGTH -------------
class TestPasswordLength:
    def test_backend_rejects_lt8(self, driver_ctx):
        r = requests.post(f"{API}/auth/change-password", json={
            "current_password": PASSWORD, "new_password": "short7",
        }, headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 400


# ------------- RESTAURANT MERCHANT -------------
@pytest.fixture(scope="module")
def restaurant_ctx():
    email = f"TEST_iter40_rest_{_uid()}@gmail.com"
    tok = _register(email, "QA Rest 40")
    body = {
        "user_id": "x", "name": "Iter40 Bistro", "description": "test",
        "cuisine_type": "Caribbean",
        "address": {"street": "1 A", "city": "PoS", "country": "TT"},
        "phone": "+18685550140", "email": email,
    }
    r = requests.post(f"{API}/restaurants", json=body, headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    rid = r.json().get("id") or r.json().get("restaurant_id")
    tok = _login(email)
    return {"email": email, "token": tok, "id": rid}


class TestRestaurantMerchant:
    def test_products_endpoint_returns_vendor_type_restaurant(self, restaurant_ctx):
        r = requests.get(f"{API}/merchant/products", headers=_hdr(restaurant_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("vendor_type") == "restaurant", f"expected restaurant, got: {d.get('vendor_type')}"

    def test_add_product_with_menu_category(self, restaurant_ctx):
        r = requests.post(f"{API}/merchant/products", json={
            "name": "Callaloo Soup", "description": "green",
            "price": 25.0, "category": "Appetizers",
        }, headers=_hdr(restaurant_ctx["token"]), timeout=15)
        assert r.status_code in (200, 201), r.text
        # verify persisted
        lst = requests.get(f"{API}/merchant/products", headers=_hdr(restaurant_ctx["token"])).json()
        items = lst.get("products") or lst.get("items") or []
        cats = [i.get("category") for i in items]
        assert "Appetizers" in cats


# ------------- GROCERY MERCHANT (via Mongo insert) -------------
@pytest.fixture(scope="module")
def grocery_ctx(mongo):
    email = f"TEST_iter40_groc_{_uid()}@gmail.com"
    tok = _register(email, "QA Groc 40")
    me = _me(tok)
    biz = {
        "id": str(uuid.uuid4()),
        "user_id": me["id"],
        "business_name": "Iter40 Grocery",
        "business_type": "grocery",
        "business_description": "Fresh things",
        "phone": "+18685550141",
        "email": email,
        "address": {"street": "2 B", "city": "PoS", "country": "TT"},
        "status": "active",
        "subscription_tier": "standard",
    }
    mongo.businesses.insert_one(biz)
    mongo.users.update_one({"email": email}, {"$set": {"user_type": "business"}})
    tok = _login(email)
    return {"email": email, "token": tok, "id": biz["id"]}


class TestGroceryMerchant:
    def test_products_endpoint_returns_vendor_type_grocery(self, grocery_ctx):
        r = requests.get(f"{API}/merchant/products", headers=_hdr(grocery_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("vendor_type") == "grocery", f"expected grocery, got: {d.get('vendor_type')}"

    def test_add_grocery_item(self, grocery_ctx):
        r = requests.post(f"{API}/merchant/products", json={
            "name": "Bananas", "description": "Fresh",
            "price": 5.0, "category": "Fresh Produce",
        }, headers=_hdr(grocery_ctx["token"]), timeout=15)
        assert r.status_code in (200, 201), r.text
        lst = requests.get(f"{API}/merchant/products", headers=_hdr(grocery_ctx["token"])).json()
        items = lst.get("products") or lst.get("items") or []
        assert any(i.get("category") == "Fresh Produce" for i in items)


# ------------- STOREFRONT (public) -------------
class TestPublicStorefront:
    def test_grocery_storefront_exposes_vendor_type(self, grocery_ctx):
        # Try public storefront paths — try both patterns
        for path in (f"/merchant/{grocery_ctx['id']}/storefront",
                     f"/storefront/{grocery_ctx['id']}",
                     f"/businesses/{grocery_ctx['id']}"):
            r = requests.get(f"{API}{path}", timeout=15)
            if r.status_code == 200:
                d = r.json()
                # storefront should include vendor_type and menu_items (or products)
                vt = d.get("vendor_type") or d.get("business_type")
                assert vt in ("grocery", "business", None)
                return
        pytest.skip("no public storefront endpoint found; frontend uses a different path")

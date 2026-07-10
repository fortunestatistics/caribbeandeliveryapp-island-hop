"""
Iteration 35 tests:
- Unified Merchant Product Manager CRUD (GET/POST/PUT/DELETE /api/merchant/products)
- Cross-merchant access denied (404)
- Storefront reflects added products via menu_items collection
- GPS FIX: POST /api/drivers/{driver_id}/location accepts lat/lng as QUERY params
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"

TS = int(time.time())


def _register(email, password="TestPass123!", name="QA User"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": name, "user_type": "customer"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _onboard_and_approve_merchant(admin_token, btype="convenience"):
    email = f"qa_merch_{btype}_{TS}_{int(time.time()*1000)%100000}@gmail.com"
    tok = _register(email, name="Merchant QA")
    payload = {
        "business_owner": {"name": "Merchant QA", "email": email, "phone": "+18685550000"},
        "business_details": {
            "business_name": f"QA Shop {btype} {TS}",
            "business_type": btype,
            "business_description": "QA test shop",
            "address": {"street": "1 QA St", "city": "POS", "parish": "", "country": "TT"},
        },
        "documents": [],
        "banking_info": None,
    }
    r = requests.post(f"{API}/business/onboarding", json=payload, headers=_auth(tok))
    assert r.status_code == 200, f"onboarding failed: {r.text}"
    app_id = r.json()["application"]["id"]
    r2 = requests.post(f"{API}/admin/businesses/{app_id}/approve", json={"notes": "QA approve"}, headers=_auth(admin_token))
    assert r2.status_code == 200, f"approve failed: {r2.status_code} {r2.text}"
    # Re-login to refresh token with new user_type
    new_tok = _login(email, "TestPass123!")
    return email, new_tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def merchant_a(admin_token):
    return _onboard_and_approve_merchant(admin_token, "convenience")


@pytest.fixture(scope="module")
def merchant_b(admin_token):
    return _onboard_and_approve_merchant(admin_token, "pharmacy")


# ---- Merchant Products CRUD ----

def test_get_products_empty(merchant_a):
    _, tok = merchant_a
    r = requests.get(f"{API}/merchant/products", headers=_auth(tok))
    assert r.status_code == 200
    data = r.json()
    assert "vendor_id" in data and "vendor_type" in data and "products" in data
    assert data["vendor_type"] == "convenience"
    assert isinstance(data["products"], list)


def test_add_product_success(merchant_a):
    _, tok = merchant_a
    r = requests.post(f"{API}/merchant/products", json={
        "name": "TEST_Aspirin", "price": 12.5, "category": "Meds", "description": "500mg"
    }, headers=_auth(tok))
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["name"] == "TEST_Aspirin"
    assert item["price"] == 12.5
    assert "id" in item
    # Verify GET returns it
    r2 = requests.get(f"{API}/merchant/products", headers=_auth(tok))
    ids = [p["id"] for p in r2.json()["products"]]
    assert item["id"] in ids
    pytest.merchant_a_pid = item["id"]
    pytest.merchant_a_vid = r2.json()["vendor_id"]


def test_add_product_missing_name(merchant_a):
    _, tok = merchant_a
    r = requests.post(f"{API}/merchant/products", json={"name": "", "price": 5}, headers=_auth(tok))
    assert r.status_code == 400


def test_add_product_bad_price(merchant_a):
    _, tok = merchant_a
    r = requests.post(f"{API}/merchant/products", json={"name": "X", "price": "abc"}, headers=_auth(tok))
    assert r.status_code == 400


def test_add_product_negative_price(merchant_a):
    _, tok = merchant_a
    r = requests.post(f"{API}/merchant/products", json={"name": "Y", "price": -1}, headers=_auth(tok))
    assert r.status_code == 400


def test_update_product(merchant_a):
    _, tok = merchant_a
    pid = pytest.merchant_a_pid
    r = requests.put(f"{API}/merchant/products/{pid}", json={"price": 19.99, "available": False}, headers=_auth(tok))
    assert r.status_code == 200
    assert r.json()["price"] == 19.99
    # Verify persistence
    r2 = requests.get(f"{API}/merchant/products", headers=_auth(tok))
    prod = next(p for p in r2.json()["products"] if p["id"] == pid)
    assert prod["price"] == 19.99
    assert prod["available"] is False


def test_cross_merchant_cannot_edit(merchant_a, merchant_b):
    pid = pytest.merchant_a_pid
    _, tok_b = merchant_b
    r = requests.put(f"{API}/merchant/products/{pid}", json={"price": 1}, headers=_auth(tok_b))
    assert r.status_code == 404
    r2 = requests.delete(f"{API}/merchant/products/{pid}", headers=_auth(tok_b))
    assert r2.status_code == 404


def test_public_storefront_shows_product(merchant_a):
    vid = pytest.merchant_a_vid
    r = requests.get(f"{API}/merchants/{vid}/storefront")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] and "QA Shop" in data["name"]
    assert data["vendor_type"] == "convenience"
    names = [m.get("name") for m in data.get("menu_items", [])]
    assert "TEST_Aspirin" in names


def test_delete_product(merchant_a):
    _, tok = merchant_a
    pid = pytest.merchant_a_pid
    r = requests.delete(f"{API}/merchant/products/{pid}", headers=_auth(tok))
    assert r.status_code == 200
    # Verify gone
    r2 = requests.get(f"{API}/merchant/products", headers=_auth(tok))
    ids = [p["id"] for p in r2.json()["products"]]
    assert pid not in ids


def test_non_merchant_customer_gets_404(admin_token):
    # register a plain customer
    email = f"qa_cust_only_{TS}@gmail.com"
    tok = _register(email)
    r = requests.get(f"{API}/merchant/products", headers=_auth(tok))
    assert r.status_code == 404


# ---- GPS FIX: driver location as query params ----

def test_driver_location_query_params():
    # This endpoint does not require auth in current backend signature; simply verify
    # it accepts lat/lng as query params and returns success.
    fake_driver_id = "qa-fake-driver-" + str(TS)
    r = requests.post(f"{API}/drivers/{fake_driver_id}/location",
                      params={"latitude": 10.65, "longitude": -61.5})
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("success") is True


def test_driver_location_json_body_rejected():
    # Confirm the fix: sending JSON body (old behavior) should NOT succeed as query params.
    fake_driver_id = "qa-fake-driver-body-" + str(TS)
    r = requests.post(f"{API}/drivers/{fake_driver_id}/location",
                      json={"latitude": 10.65, "longitude": -61.5})
    # FastAPI expects them as query params -> body-only should 422
    assert r.status_code == 422, f"expected 422, got {r.status_code}"

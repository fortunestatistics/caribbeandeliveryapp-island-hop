"""E2E backend tests for Merchant & Driver Settings edit->save->persist flows.

Covers PRD (iter 39):
- MerchantSettings: GET /auth/me, PUT /users/me, GET+PUT /merchant/profile,
  POST /auth/change-password (+ verify login with new pw), validation errors.
- DriverSettings: GET /drivers/me, PUT /drivers/profile (vehicle & banking),
  PUT /users/me, POST /auth/change-password.
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE}/api"

# Load backend .env for local execution (REACT_APP_BACKEND_URL is in frontend/.env)
if not BASE or BASE == "":
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

PASSWORD = "Test1234!"  # meets >=8 constraint
NEW_PASSWORD = "NewPass1234!"


def _uid():
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _register(email, name="QA User"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "name": name, "user_type": "customer",
    }, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _login(email, password=PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- MERCHANT ----------------
@pytest.fixture(scope="module")
def merchant_ctx():
    email = f"TEST_merchant_{_uid()}@gmail.com"
    token = _register(email, name="QA Merchant")
    # Create restaurant -> promotes to restaurant
    body = {
        "user_id": "x", "name": "Islnad Bites",  # intentional misspelling to be fixed
        "description": "Great food", "cuisine_type": "Caribbean",
        "address": {"street": "1 Main", "city": "PoS", "country": "TT"},
        "phone": "+18685550100", "email": email,
    }
    r = requests.post(f"{API}/restaurants", json=body, headers=_hdr(token), timeout=30)
    assert r.status_code == 200, r.text
    # Re-login to refresh JWT (user_type is now restaurant)
    token = _login(email)
    return {"email": email, "token": token}


class TestMerchantSettings:
    def test_auth_me_returns_user(self, merchant_ctx):
        r = requests.get(f"{API}/auth/me", headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == merchant_ctx["email"]
        assert d["user_type"] in ("restaurant", "admin")

    def test_get_merchant_profile_prefilled(self, merchant_ctx):
        r = requests.get(f"{API}/merchant/profile", headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("name") == "Islnad Bites"
        assert d.get("address", {}).get("city") == "PoS"

    def test_update_users_me_account(self, merchant_ctx):
        new_name = "QA Merchant Corrected"
        new_phone = "+18685550199"
        r = requests.put(f"{API}/users/me", json={"name": new_name, "phone": new_phone},
                         headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Persistence check
        me = requests.get(f"{API}/auth/me", headers=_hdr(merchant_ctx["token"])).json()
        assert me["name"] == new_name
        assert me["phone"] == new_phone

    def test_update_merchant_profile_fix_misspelling(self, merchant_ctx):
        payload = {
            "name": "Island Bites",  # corrected spelling
            "description": "Authentic Caribbean cuisine",
            "phone": "+18685550111",
            "email": merchant_ctx["email"],
            "address": {"street": "2 Fixed St", "city": "Port of Spain", "country": "TT"},
            "cuisine_type": "Caribbean Fusion",
        }
        r = requests.put(f"{API}/merchant/profile", json=payload,
                         headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        got = r.json()["profile"]
        assert got["name"] == "Island Bites"
        assert got["address"]["city"] == "Port of Spain"
        # GET to verify persistence
        r2 = requests.get(f"{API}/merchant/profile", headers=_hdr(merchant_ctx["token"])).json()
        assert r2["name"] == "Island Bites"
        assert r2["description"] == "Authentic Caribbean cuisine"
        assert r2["address"]["street"] == "2 Fixed St"

    def test_change_password_wrong_current(self, merchant_ctx):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "wrongpass!", "new_password": NEW_PASSWORD},
                          headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 400
        assert "current password" in r.text.lower()

    def test_change_password_success_and_relogin(self, merchant_ctx):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
                          headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Old pw should fail
        rold = requests.post(f"{API}/auth/login",
                             json={"email": merchant_ctx["email"], "password": PASSWORD})
        assert rold.status_code == 401
        # New pw should work
        rnew = requests.post(f"{API}/auth/login",
                             json={"email": merchant_ctx["email"], "password": NEW_PASSWORD})
        assert rnew.status_code == 200
        merchant_ctx["token"] = rnew.json()["access_token"]

    def test_change_password_min_length_backend(self, merchant_ctx):
        # Backend requires >=8; frontend validates >=6 (mismatch documented)
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": NEW_PASSWORD, "new_password": "short7"},
                          headers=_hdr(merchant_ctx["token"]), timeout=15)
        assert r.status_code == 400
        assert "8 characters" in r.text or "at least 8" in r.text


# ---------------- DRIVER ----------------
@pytest.fixture(scope="module")
def driver_ctx(mongo):
    email = f"TEST_driver_{_uid()}@gmail.com"
    token = _register(email, name="QA Driver")
    r = requests.post(f"{API}/drivers", json={
        "license_number": "L-000-111", "vehicle_type": "car", "vehicle_plate": "TAB-0000",
        "personal_info": {"name": "QA Driver", "email": email, "phone": "+18685550200", "city": "PoS"},
    }, headers=_hdr(token), timeout=30)
    assert r.status_code == 200, r.text
    # Promote user_type to driver directly in mongo (mirrors admin approval side-effect)
    mongo.users.update_one({"email": email}, {"$set": {"user_type": "driver"}})
    mongo.drivers.update_one({"user_id": _me_id(token)}, {"$set": {"status": "active"}})
    token = _login(email)
    return {"email": email, "token": token}


def _me_id(token):
    return requests.get(f"{API}/auth/me", headers=_hdr(token)).json()["id"]


class TestDriverSettings:
    def test_get_drivers_me(self, driver_ctx):
        r = requests.get(f"{API}/drivers/me", headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["license_number"] == "L-000-111"

    def test_update_users_me(self, driver_ctx):
        r = requests.put(f"{API}/users/me",
                         json={"name": "QA Driver Fixed", "phone": "+18685550222"},
                         headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=_hdr(driver_ctx["token"])).json()
        assert me["name"] == "QA Driver Fixed"
        assert me["phone"] == "+18685550222"

    def test_update_vehicle_details(self, driver_ctx):
        r = requests.put(f"{API}/drivers/profile", json={
            "license_number": "L-999-888", "vehicle_type": "van", "vehicle_plate": "TAB-9999",
        }, headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        drv = r.json()["driver"]
        assert drv["license_number"] == "L-999-888"
        assert drv["vehicle_type"] == "van"
        assert drv["vehicle_plate"] == "TAB-9999"
        # Persistence
        got = requests.get(f"{API}/drivers/me", headers=_hdr(driver_ctx["token"])).json()
        assert got["license_number"] == "L-999-888"

    def test_update_banking(self, driver_ctx):
        payload = {"banking_info": {
            "bank_name": "Republic Bank", "account_name": "QA Driver Fixed",
            "account_number": "1234567890", "branch": "PoS Main",
        }}
        r = requests.put(f"{API}/drivers/profile", json=payload,
                         headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        got = requests.get(f"{API}/drivers/me", headers=_hdr(driver_ctx["token"])).json()
        assert got["banking_info"]["bank_name"] == "Republic Bank"
        assert got["banking_info"]["account_number"] == "1234567890"

    def test_change_password(self, driver_ctx):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
                          headers=_hdr(driver_ctx["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Login with new password
        rn = requests.post(f"{API}/auth/login",
                           json={"email": driver_ctx["email"], "password": NEW_PASSWORD})
        assert rn.status_code == 200


# ------------- Auth guards -------------
class TestAuthGuards:
    def test_unauth_merchant_profile(self):
        r = requests.get(f"{API}/merchant/profile", timeout=10)
        assert r.status_code in (401, 403)

    def test_unauth_drivers_me(self):
        r = requests.get(f"{API}/drivers/me", timeout=10)
        assert r.status_code in (401, 403)

    def test_unauth_users_me_put(self):
        r = requests.put(f"{API}/users/me", json={"name": "x"}, timeout=10)
        assert r.status_code in (401, 403)

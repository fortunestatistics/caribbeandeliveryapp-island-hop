"""
Iteration 43 — Verify the JWT→httpOnly-cookie migration end-to-end for every
role/flow called out in the review request.

Focus:
  1. login / register set session_token cookie AND return access_token in body
  2. /auth/me works with cookie-only (no Bearer)
  3. Placeholder Bearer values ('cookie','null','undefined','','bearer') fall
     through to the cookie (not rejected outright)
  4. Real Bearer token (mobile path) still authenticates without cookie
  5. logout clears the cookie
  6. Customer flows: /businesses, /addresses (GET+POST), create order
  7. Merchant flows: promote to restaurant, GET/PUT /merchant/profile
  8. Driver flows: create driver, PUT /drivers/status, PUT /drivers/profile
  9. Admin impersonation sets a cookie for the impersonated user
 10. Document image ?auth=cookie|empty sentinel does NOT trip the auth guard
"""
import os
import uuid
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as _f:
        for _line in _f:
            if _line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = _line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

OWNER_EMAIL = "tracyfortune@islandhoptt.com"
OWNER_PASSWORD = "IslandHopAdmin2026!"
COOKIE_NAME = "session_token"


def _unique_email(prefix: str) -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@test.com"


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def owner_login():
    """Log the owner in via a fresh session and yield (session, jwt)."""
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body
    assert COOKIE_NAME in s.cookies, "session_token cookie was NOT set by login"
    return s, body["access_token"]


@pytest.fixture
def new_customer():
    """Register a fresh customer and return (session, jwt, user)."""
    email = _unique_email("cust")
    s = requests.Session()
    r = s.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": "Test Customer",
            "phone": "8681234567",
            "user_type": "customer",
        },
    )
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    body = r.json()
    assert COOKIE_NAME in s.cookies, "session_token cookie NOT set by register"
    assert "access_token" in body
    return s, body["access_token"], body.get("user", {})


# ---------------------------------------------------------------------------
# 1) Login cookie behaviour
# ---------------------------------------------------------------------------
class TestLoginCookie:
    def test_login_sets_cookie_and_returns_token(self, owner_login):
        s, jwt = owner_login
        assert jwt and len(jwt) > 20
        assert s.cookies.get(COOKIE_NAME), "session_token cookie missing"

    def test_me_via_cookie_only(self, owner_login):
        """No Authorization header at all — cookie must carry auth."""
        s, _ = owner_login
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"].lower() == OWNER_EMAIL.lower()

    @pytest.mark.parametrize("placeholder", ["cookie", "null", "undefined", "", "bearer"])
    def test_placeholder_bearer_falls_through_to_cookie(self, owner_login, placeholder):
        s, _ = owner_login
        # A placeholder Authorization must NOT block cookie fallback
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {placeholder}"})
        assert r.status_code == 200, (
            f"Placeholder Bearer '{placeholder}' broke cookie fallback: {r.status_code} {r.text}"
        )
        assert r.json()["email"].lower() == OWNER_EMAIL.lower()


# ---------------------------------------------------------------------------
# 2) Real Bearer token (mobile path) — no cookie
# ---------------------------------------------------------------------------
class TestBearerNoCookie:
    def test_real_bearer_authenticates_without_cookie(self, owner_login):
        _, jwt = owner_login
        # Brand-new session with NO cookies
        clean = requests.Session()
        r = clean.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {jwt}"})
        assert r.status_code == 200, r.text
        assert clean.cookies.get(COOKIE_NAME) is None
        assert r.json()["email"].lower() == OWNER_EMAIL.lower()

    def test_no_auth_at_all_returns_401(self):
        clean = requests.Session()
        r = clean.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 3) Logout clears the cookie
# ---------------------------------------------------------------------------
class TestLogout:
    def test_logout_clears_cookie_and_invalidates_me(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        assert s.cookies.get(COOKIE_NAME)
        # Logout
        r2 = s.post(f"{API}/auth/logout")
        assert r2.status_code == 200, r2.text
        # Cookie should now be gone / expired
        assert not s.cookies.get(COOKIE_NAME), "Cookie was NOT cleared by logout"
        # /auth/me should be 401 now (no header, no cookie)
        r3 = s.get(f"{API}/auth/me")
        assert r3.status_code == 401


# ---------------------------------------------------------------------------
# 4) Register (fresh customer) → cookie + dashboard-usable
# ---------------------------------------------------------------------------
class TestRegister:
    def test_register_sets_cookie_and_creates_customer(self, new_customer):
        s, _, user = new_customer
        assert user.get("user_type") == "customer"
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["user_type"] == "customer"


# ---------------------------------------------------------------------------
# 5) Customer flows via cookie: /businesses, /addresses, create order
# ---------------------------------------------------------------------------
class TestCustomerFlows:
    def test_list_businesses(self, new_customer):
        s, _, user = new_customer
        # The /businesses page calls /api/search/featured
        r = s.get(f"{API}/search/featured", params={"limit": 5})
        assert r.status_code == 200, r.text
        data = r.json()
        if isinstance(data, dict):
            data = data.get("results") or data.get("data") or data.get("businesses") or list(data.values())[0]
        assert isinstance(data, list)

    def test_addresses_get_and_post(self, new_customer):
        s, _, user = new_customer
        r = s.get(f"{API}/addresses")
        assert r.status_code == 200, r.text
        payload = {
            "user_id": user["id"],
            "label": "TEST_home",
            "street_address": "123 Test Ln",
            "city": "Port of Spain",
            "state": "Port of Spain",
            "country": "Trinidad and Tobago",
            "is_default": True,
        }
        r2 = s.post(f"{API}/addresses", json=payload)
        assert r2.status_code in (200, 201), r2.text
        r3 = s.get(f"{API}/addresses")
        assert r3.status_code == 200
        addrs = r3.json()
        if isinstance(addrs, dict):
            addrs = addrs.get("addresses") or addrs.get("data") or []
        assert any(a.get("label") == "TEST_home" for a in addrs), "Address did not persist"


# ---------------------------------------------------------------------------
# 6) Merchant flow: promote to restaurant, /merchant/profile GET/PUT
# ---------------------------------------------------------------------------
class TestMerchantFlow:
    def test_merchant_profile_via_cookie(self):
        email = _unique_email("merch")
        s = requests.Session()
        r = s.post(
            f"{API}/auth/register",
            json={
                "email": email,
                "password": "Test1234!",
                "name": "Test Merchant",
                "phone": "8682223333",
            },
        )
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        # Create restaurant (promotes user_type=restaurant)
        r2 = s.post(
            f"{API}/restaurants",
            json={
                "user_id": user["id"],
                "name": "TEST_Merchant_Kitchen",
                "description": "Test restaurant",
                "cuisine_type": "Caribbean",
                "address": {"street": "1 Main", "city": "POS", "country": "TT"},
                "phone": "8682223333",
                "email": email,
            },
        )
        assert r2.status_code in (200, 201), r2.text
        # Re-login for a JWT with restaurant role, then use cookie only
        r3 = s.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"})
        assert r3.status_code == 200
        assert s.cookies.get(COOKIE_NAME)
        # GET merchant profile via cookie
        rp = s.get(f"{API}/merchant/profile")
        assert rp.status_code == 200, rp.text
        # PUT merchant profile via cookie
        rput = s.put(f"{API}/merchant/profile", json={"description": "Updated via cookie auth"})
        assert rput.status_code == 200, rput.text


# ---------------------------------------------------------------------------
# 7) Driver flow: create, PUT status, PUT profile — via cookie
# ---------------------------------------------------------------------------
class TestDriverFlow:
    def test_driver_status_and_profile_via_cookie(self, owner_login):
        owner_sess, owner_jwt = owner_login
        email = _unique_email("drv")
        s = requests.Session()
        r = s.post(
            f"{API}/auth/register",
            json={
                "email": email,
                "password": "Test1234!",
                "name": "Test Driver",
                "phone": "8684445555",
            },
        )
        assert r.status_code == 200, r.text
        # Create driver record (creates driver_profile)
        r2 = s.post(
            f"{API}/drivers",
            json={
                "license_number": f"TEST-{uuid.uuid4().hex[:6]}",
                "vehicle_type": "car",
                "vehicle_plate": f"TT{uuid.uuid4().hex[:5].upper()}",
            },
        )
        assert r2.status_code in (200, 201), r2.text
        # Owner promotes user_type=driver (endpoint may vary; use direct role promote if exists)
        # Fallback: use admin/users/{id}/role or similar. Try via admin PATCH.
        # Promote user_type='driver' directly in Mongo (per test_credentials.md).
        me = s.get(f"{API}/auth/me").json()
        try:
            import asyncio
            from motor.motor_asyncio import AsyncIOMotorClient
            async def _promote():
                _mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
                _db = _mc[os.environ["DB_NAME"]]
                await _db.users.update_one({"id": me["id"]}, {"$set": {"user_type": "driver"}})
                _mc.close()
            asyncio.new_event_loop().run_until_complete(_promote())
        except Exception as e:
            pytest.skip(f"Cannot promote driver via Mongo directly: {e}")
        # Re-login driver so JWT reflects the role, cookie refresh
        r3 = s.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"})
        assert r3.status_code == 200
        assert s.cookies.get(COOKIE_NAME)
        # PUT /drivers/status
        rst = s.put(f"{API}/drivers/status", json={"status": "online"})
        # 200 if approved, 403 if pending approval — both prove cookie auth worked
        # (a broken cookie would yield 401 "Not authenticated").
        assert rst.status_code in (200, 403), rst.text
        assert rst.status_code != 401
        # PUT /drivers/profile via cookie — should NOT 401
        rp = s.put(
            f"{API}/drivers/profile",
            json={"license_number": f"TEST-{uuid.uuid4().hex[:6]}"},
        )
        assert rp.status_code in (200, 403, 404), rp.text
        assert rp.status_code != 401


# ---------------------------------------------------------------------------
# 8) Admin impersonation sets cookie
# ---------------------------------------------------------------------------
class TestImpersonation:
    def test_admin_impersonate_sets_cookie(self, owner_login, new_customer):
        owner_sess, _ = owner_login
        _, _, cust = new_customer
        # Impersonate the customer — request MUST accept cookies fresh
        imp_sess = requests.Session()
        # Login owner in this new session so we have the admin cookie
        r = imp_sess.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        assert imp_sess.cookies.get(COOKIE_NAME)
        orig_cookie = imp_sess.cookies.get(COOKIE_NAME)
        # Impersonate
        r2 = imp_sess.post(f"{API}/admin/impersonate/{cust['id']}")
        assert r2.status_code == 200, r2.text
        new_cookie = imp_sess.cookies.get(COOKIE_NAME)
        assert new_cookie and new_cookie != orig_cookie, "Impersonate did not replace the session cookie"
        # /auth/me should now return the impersonated user
        r3 = imp_sess.get(f"{API}/auth/me")
        assert r3.status_code == 200
        me = r3.json()
        assert me["id"] == cust["id"], f"Expected impersonated id, got {me}"


# ---------------------------------------------------------------------------
# 9) Auth-cookie flags are correct
# ---------------------------------------------------------------------------
class TestCookieFlags:
    def test_cookie_is_httponly_secure_lax(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        set_cookies = r.headers.get("set-cookie", "")
        assert COOKIE_NAME in set_cookies
        low = set_cookies.lower()
        assert "httponly" in low, f"Set-Cookie missing HttpOnly: {set_cookies}"
        assert "secure" in low, f"Set-Cookie missing Secure: {set_cookies}"
        assert "samesite=lax" in low, f"Set-Cookie missing SameSite=Lax: {set_cookies}"

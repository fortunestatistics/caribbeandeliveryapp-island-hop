"""Iter 54: Admin account repair (driver/customer/merchant) + driver accept-order JSON body."""
import os
import pytest
import requests

def _read_env():
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                return ln.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

BASE = os.environ.get("REACT_APP_BACKEND_URL", _read_env()).rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"
BROKEN_DRIVER_EMAIL = "brokendriver_1784996815@gmail.com"
BROKEN_DRIVER_PASSWORD = "Test1234!"
FIXED_DRIVER_EMAIL = "qatest_1784993477@gmail.com"
FIXED_DRIVER_PASSWORD = "Test1234!"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}"}


# -------- Admin account lookup + repair --------
class TestAccountRepair:
    def test_lookup_requires_admin(self):
        r = requests.get(f"{API}/admin/accounts/lookup", params={"q": "broken"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_lookup_min_length(self, admin_headers):
        r = requests.get(f"{API}/admin/accounts/lookup", params={"q": "a"}, headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_lookup_finds_broken_driver(self, admin_headers):
        r = requests.get(f"{API}/admin/accounts/lookup",
                         params={"q": "brokendriver"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1
        rows = data["results"]
        assert any(BROKEN_DRIVER_EMAIL in (row.get("email") or "") for row in rows), rows

    def test_repair_broken_driver_then_healthy(self, admin_headers):
        r = requests.get(f"{API}/admin/accounts/lookup",
                         params={"q": "brokendriver"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        row = next((x for x in r.json()["results"]
                    if BROKEN_DRIVER_EMAIL in (x.get("email") or "")), None)
        assert row, "broken driver row not found"
        body = {"user_id": row["user_id"]} if row.get("user_id") else {"driver_id": row["driver_id"]}
        rep = requests.post(f"{API}/admin/accounts/repair", json=body,
                            headers=admin_headers, timeout=20)
        assert rep.status_code == 200, rep.text
        data = rep.json()
        assert data["success"] is True
        # actions may be empty if already repaired by a prior test run — accept either
        assert isinstance(data.get("actions"), list)
        acct = data["account"]
        # after repair the account should be healthy and role should be driver
        assert acct["healthy"] is True, acct
        assert acct.get("user_type") == "driver", acct

        # Idempotency: repair again should still be healthy
        rep2 = requests.post(f"{API}/admin/accounts/repair", json=body,
                             headers=admin_headers, timeout=20)
        assert rep2.status_code == 200
        assert rep2.json()["account"]["healthy"] is True

    def test_broken_driver_can_login_as_driver_after_repair(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": BROKEN_DRIVER_EMAIL, "password": BROKEN_DRIVER_PASSWORD},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["user_type"] == "driver", data["user"]


# -------- Driver accept-order JSON body regression (P0) --------
class TestDriverAcceptJsonBody:
    def test_accept_missing_driver_id_returns_422_not_500(self):
        # Auth as fixed driver
        token = _login(FIXED_DRIVER_EMAIL, FIXED_DRIVER_PASSWORD)
        h = {"Authorization": f"Bearer {token}"}
        # Non-existent order id — but body must be JSON-parsed. Missing driver_id → 422.
        r = requests.post(f"{API}/orders/nonexistent-order-xyz/accept-driver",
                          json={}, headers=h, timeout=15)
        # Prior bug: query-param → 422 for correct body. Now body model → either 422 for
        # missing driver_id or 404 for order not found. Should NOT be 500.
        assert r.status_code in (400, 404, 422), r.text

    def test_accept_with_json_body_shape_accepted(self):
        token = _login(FIXED_DRIVER_EMAIL, FIXED_DRIVER_PASSWORD)
        h = {"Authorization": f"Bearer {token}"}
        # Send correct shape but non-existent order → should return 404 (not 422 for bad param)
        r = requests.post(f"{API}/orders/nonexistent-order-xyz/accept-driver",
                          json={"driver_id": "qadrv_2978c0f6"}, headers=h, timeout=15)
        assert r.status_code in (400, 403, 404), r.text

"""Iteration 33: Admin User Management upgrades - user_type filter, set-status, auth gate."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASS = "AdminQA1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def throwaway_customer():
    ts = int(time.time())
    email = f"qa_iter33_{ts}@gmail.com"
    pw = "Test1234!"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": pw, "name": "QA Iter33", "user_type": "customer"
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": pw, "id": data["user"]["id"], "token": data["access_token"]}


# ----- user_type filter -----

class TestUserTypeFilter:
    def test_all(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users?user_type=all", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        # NOTE: hashed_password IS currently returned by /api/admin/users (security concern - reported)

    def test_customer_only(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users?user_type=customer", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        for u in users:
            ut = (u.get("user_type") or "").lower()
            assert ut in ("customer", "", None) or ut == "customer"

    def test_driver_only(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users?user_type=driver", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        for u in users:
            assert (u.get("user_type") or "").lower() == "driver"

    def test_merchant_filter(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users?user_type=merchant", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        for u in users:
            assert (u.get("user_type") or "").lower() in ("restaurant", "business", "merchant")


# ----- set-status + auth gate -----

class TestAuthGate:
    def test_paused_blocks_login(self, admin_headers, throwaway_customer):
        uid = throwaway_customer["id"]
        # pause
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/set-status",
                          json={"status": "paused"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paused"
        # login blocked
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": throwaway_customer["email"], "password": throwaway_customer["password"]})
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"
        assert "support" in r.text.lower() or "paused" in r.text.lower()

    def test_restricted_blocks_login(self, admin_headers, throwaway_customer):
        uid = throwaway_customer["id"]
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/set-status",
                          json={"status": "restricted"}, headers=admin_headers)
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": throwaway_customer["email"], "password": throwaway_customer["password"]})
        assert r.status_code == 403

    def test_active_restores_login(self, admin_headers, throwaway_customer):
        uid = throwaway_customer["id"]
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/set-status",
                          json={"status": "active"}, headers=admin_headers)
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": throwaway_customer["email"], "password": throwaway_customer["password"]})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_authenticated_api_blocked_when_paused(self, admin_headers, throwaway_customer):
        uid = throwaway_customer["id"]
        # customer token still exists from earlier
        cust_token = throwaway_customer["token"]
        # pause
        requests.post(f"{BASE_URL}/api/admin/users/{uid}/set-status",
                      json={"status": "paused"}, headers=admin_headers)
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {cust_token}"})
        assert r.status_code == 403, f"expected 403 for paused user API call, got {r.status_code}"
        # restore
        requests.post(f"{BASE_URL}/api/admin/users/{uid}/set-status",
                      json={"status": "active"}, headers=admin_headers)


# ----- self / staff protection -----

class TestSelfProtection:
    def test_cannot_pause_self(self, admin_headers):
        # get admin id
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        admin_id = r.json()["id"]
        r = requests.post(f"{BASE_URL}/api/admin/users/{admin_id}/set-status",
                          json={"status": "paused"}, headers=admin_headers)
        assert r.status_code == 400

    def test_invalid_status(self, admin_headers, throwaway_customer):
        r = requests.post(f"{BASE_URL}/api/admin/users/{throwaway_customer['id']}/set-status",
                          json={"status": "bogus"}, headers=admin_headers)
        assert r.status_code == 400

    def test_non_admin_forbidden(self, throwaway_customer):
        r = requests.post(f"{BASE_URL}/api/admin/users/{throwaway_customer['id']}/set-status",
                          json={"status": "paused"},
                          headers={"Authorization": f"Bearer {throwaway_customer['token']}"})
        assert r.status_code == 403

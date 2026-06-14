"""Backend tests for Mercury admin endpoints and Google social auth (iteration 9)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fall back to reading from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")

TS = int(time.time())


@pytest.fixture(scope="module")
def admin_token():
    payload = {
        "email": f"someadmin_{TS}@gmail.com",
        "password": "Admin1234!",
        "name": "Test Admin",
        "user_type": "admin",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"register admin failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    assert token, f"no access_token in response: {r.text}"
    return token


@pytest.fixture(scope="module")
def customer_token():
    payload = {
        "email": f"customer_{TS}@gmail.com",
        "password": "Cust1234!",
        "name": "Test Customer",
        "user_type": "customer",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"register customer failed: {r.status_code} {r.text}"
    return r.json().get("access_token")


# ---------- Mercury admin endpoints ----------

class TestMercuryStatus:
    def test_status_as_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"unexpected: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("configured") is True
        assert data.get("connected") is True
        assert data.get("account_count") == 3, f"account_count = {data.get('account_count')}"

    def test_status_as_customer_forbidden(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/status",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=20,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_status_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/mercury/status", timeout=20)
        assert r.status_code in (401, 403)


class TestMercuryAccounts:
    def test_accounts_as_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/accounts",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"unexpected: {r.status_code} {r.text}"
        data = r.json()
        assert "accounts" in data
        accounts = data["accounts"]
        assert isinstance(accounts, list)
        assert len(accounts) == 3, f"expected 3 accounts, got {len(accounts)}"
        for acc in accounts:
            assert "id" in acc
            assert "name" in acc
            assert "available_balance" in acc
            assert "current_balance" in acc

    def test_accounts_as_customer_forbidden(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/accounts",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=20,
        )
        assert r.status_code == 403


class TestMercuryReconciliation:
    def test_reconciliation_as_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/reconciliation?days=30",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200, f"unexpected: {r.status_code} {r.text}"
        data = r.json()
        assert "summary" in data
        summary = data["summary"]
        for key in ("total_payouts", "matched", "unmatched", "mercury_transactions_scanned"):
            assert key in summary, f"missing key {key} in summary"
        assert "reconciliation" in data
        assert isinstance(data["reconciliation"], list)

    def test_reconciliation_as_customer_forbidden(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/mercury/reconciliation?days=30",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=20,
        )
        assert r.status_code == 403


# ---------- Google social auth ----------

class TestGoogleSocialAuth:
    def test_invalid_session_id_returns_401_not_500(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/social/google",
            json={"session_id": "fake-invalid-session-id-xyz-12345"},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"
        body = r.json()
        detail = (body.get("detail") or "").lower()
        assert ("sign" in detail or "expired" in detail or "failed" in detail or "invalid" in detail), (
            f"detail should mention sign-in/expired/failed/invalid, got: {body}"
        )

    def test_missing_session_id_does_not_500(self):
        r = requests.post(f"{BASE_URL}/api/auth/social/google", json={}, timeout=20)
        # Must not be a 500. Accept 400/401/422.
        assert r.status_code != 500, f"server error on missing session_id: {r.text}"

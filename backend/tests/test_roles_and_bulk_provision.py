"""Backend tests for the dual-role switcher endpoints and admin bulk merchant provisioning."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PW = "IslandHopAdmin2026!"
DUAL_EMAIL = "qatest_1784993477@gmail.com"
DUAL_PW = "Test1234!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def dual_token():
    return _login(DUAL_EMAIL, DUAL_PW)


# ---- Bulk merchant provisioning ----
def test_provision_all_merchants_admin(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/merchants/provision-all",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["success"] is True
    assert "provisioned_count" in data
    assert isinstance(data["provisioned"], list)


def test_provision_all_merchants_requires_admin(dual_token):
    r = requests.post(f"{BASE_URL}/api/admin/merchants/provision-all",
                      headers={"Authorization": f"Bearer {dual_token}"}, timeout=30)
    assert r.status_code == 403


# ---- Dual role switcher ----
def test_available_roles_dual(dual_token):
    r = requests.get(f"{BASE_URL}/api/users/available-roles",
                     headers={"Authorization": f"Bearer {dual_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["can_switch"] is True
    roles = set(data["available_roles"])
    assert {"customer", "driver"}.issubset(roles)
    assert "business" in roles or "restaurant" in roles


def test_switch_role_and_back(dual_token):
    # Switch to business
    r = requests.post(f"{BASE_URL}/api/users/switch-role", json={"role": "business"},
                      headers={"Authorization": f"Bearer {dual_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["active_role"] == "business"

    # Verify via available-roles
    v = requests.get(f"{BASE_URL}/api/users/available-roles",
                     headers={"Authorization": f"Bearer {dual_token}"}, timeout=30).json()
    assert v["active_role"] == "business"

    # Switch back to driver (leave account in clean state)
    r2 = requests.post(f"{BASE_URL}/api/users/switch-role", json={"role": "driver"},
                       headers={"Authorization": f"Bearer {dual_token}"}, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["active_role"] == "driver"


def test_switch_role_invalid_denied(dual_token):
    r = requests.post(f"{BASE_URL}/api/users/switch-role", json={"role": "admin"},
                      headers={"Authorization": f"Bearer {dual_token}"}, timeout=30)
    assert r.status_code == 403


def test_available_roles_admin_empty(admin_token):
    """Staff should NOT get any switchable roles."""
    r = requests.get(f"{BASE_URL}/api/users/available-roles",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["available_roles"] == []
    assert data["can_switch"] is False

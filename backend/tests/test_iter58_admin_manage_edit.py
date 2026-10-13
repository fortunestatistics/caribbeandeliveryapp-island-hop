"""Iter 58: Admin Edit-Any-Profile panel + editable impersonation.

Verifies:
- GET  /api/admin/users/{user_id}/manage
- PUT  /api/admin/users/{user_id}/account
- PUT  /api/admin/merchants/{vendor_id}/profile
- PUT  /api/admin/merchants/{vendor_id}/storefront (logo/cover)
- PUT  /api/admin/drivers/{driver_id}/profile
- POST /api/admin/impersonate/{user_id}?edit=0|1  -> readonly flag flips
- Editable impersonation token can write; readonly one cannot (403)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as _fh:
        for _line in _fh:
            if _line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = _line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"
DRIVER_EMAIL = "qatest_1784993477@gmail.com"
DRIVER_PASSWORD = "Test1234!"
MERCHANT_EMAIL = "merch_1784954600@gmail.com"  # Alert Test Mart (business)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- lookup helpers ----------
def _lookup(h, q):
    r = requests.get(f"{API}/admin/accounts/lookup", params={"q": q}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("results", [])


@pytest.fixture(scope="module")
def merchant_row(h):
    for term in ("merch_1784954600", "Alert Test Mart", "merch"):
        for r in _lookup(h, term):
            if r.get("user_id") and r.get("merchant"):
                return r
    pytest.skip("No merchant with user_id found in lookup")


@pytest.fixture(scope="module")
def driver_row(h):
    for r in _lookup(h, "qatest"):
        if r.get("user_id") and r.get("driver"):
            return r
    pytest.skip("No driver with user_id found in lookup")


# ---------- GET /manage ----------
def test_manage_get_merchant(h, merchant_row):
    r = requests.get(f"{API}/admin/users/{merchant_row['user_id']}/manage", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["account"]["email"]
    assert j["merchant"] is not None
    assert j["merchant"]["vendor_id"]


def test_manage_get_driver(h, driver_row):
    r = requests.get(f"{API}/admin/users/{driver_row['user_id']}/manage", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["driver"] is not None
    assert j["driver"]["driver_id"]


def test_manage_get_404(h):
    r = requests.get(f"{API}/admin/users/does-not-exist/manage", headers=h, timeout=30)
    assert r.status_code == 404


# ---------- PUT /account ----------
def test_update_account_persists(h, merchant_row):
    uid = merchant_row["user_id"]
    orig = requests.get(f"{API}/admin/users/{uid}/manage", headers=h).json()["account"]
    new_phone = f"+1868555{int(time.time()) % 10000:04d}"
    r = requests.put(
        f"{API}/admin/users/{uid}/account",
        json={"phone": new_phone, "name": orig["name"] or "Merch Owner"},
        headers=h, timeout=30,
    )
    assert r.status_code == 200, r.text
    # verify persistence via GET
    got = requests.get(f"{API}/admin/users/{uid}/manage", headers=h).json()["account"]
    assert got["phone"] == new_phone


# ---------- PUT /merchant/profile ----------
def test_update_merchant_profile_persists(h, merchant_row):
    vid = merchant_row["merchant"]["vendor_id"] if isinstance(merchant_row.get("merchant"), dict) and merchant_row["merchant"].get("vendor_id") else None
    if not vid:
        mg = requests.get(f"{API}/admin/users/{merchant_row['user_id']}/manage", headers=h).json()
        vid = mg["merchant"]["vendor_id"]
    new_fee = round(1.0 + (time.time() % 20), 2)
    new_desc = f"Iter58 QA edit @ {int(time.time())}"
    r = requests.put(
        f"{API}/admin/merchants/{vid}/profile",
        json={"delivery_fee": new_fee, "description": new_desc, "minimum_order": 5.0},
        headers=h, timeout=30,
    )
    assert r.status_code == 200, r.text
    got = requests.get(f"{API}/admin/users/{merchant_row['user_id']}/manage", headers=h).json()["merchant"]
    assert got["description"] == new_desc
    assert abs(float(got["delivery_fee"]) - new_fee) < 0.01


# ---------- PUT /merchant/storefront (logo) ----------
def test_update_merchant_storefront_image(h, merchant_row):
    mg = requests.get(f"{API}/admin/users/{merchant_row['user_id']}/manage", headers=h).json()
    vid = mg["merchant"]["vendor_id"]
    # tiny 1x1 png data-url
    tiny = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
            "+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    r = requests.put(
        f"{API}/admin/merchants/{vid}/storefront",
        json={"logo": tiny},
        headers=h, timeout=30,
    )
    assert r.status_code == 200, r.text
    got = requests.get(f"{API}/admin/users/{merchant_row['user_id']}/manage", headers=h).json()["merchant"]
    assert got.get("logo") == tiny


# ---------- PUT /driver/profile ----------
def test_update_driver_profile_persists(h, driver_row):
    mg = requests.get(f"{API}/admin/users/{driver_row['user_id']}/manage", headers=h).json()
    did = mg["driver"]["driver_id"]
    new_plate = f"QA-{int(time.time()) % 10000:04d}"
    r = requests.put(
        f"{API}/admin/drivers/{did}/profile",
        json={"vehicle_plate": new_plate},
        headers=h, timeout=30,
    )
    assert r.status_code == 200, r.text
    got = requests.get(f"{API}/admin/users/{driver_row['user_id']}/manage", headers=h).json()["driver"]
    assert got["vehicle_plate"] == new_plate


# ---------- impersonation edit flag ----------
def test_impersonate_readonly_flag(h, merchant_row):
    r = requests.post(f"{API}/admin/impersonate/{merchant_row['user_id']}", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["readonly"] is True
    assert j["token"]


def test_impersonate_edit_flag(h, merchant_row):
    r = requests.post(f"{API}/admin/impersonate/{merchant_row['user_id']}", params={"edit": 1}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["readonly"] is False


def test_impersonate_edit_write_allowed_readonly_blocked(h, merchant_row):
    # editable impersonation -> PUT /api/users/me should succeed
    edit_tok = requests.post(
        f"{API}/admin/impersonate/{merchant_row['user_id']}", params={"edit": 1}, headers=h
    ).json()["token"]
    r = requests.put(
        f"{API}/users/me",
        json={"phone": f"+1868999{int(time.time()) % 10000:04d}"},
        headers={"Authorization": f"Bearer {edit_tok}"}, timeout=30,
    )
    assert r.status_code == 200, f"editable impersonation write blocked: {r.status_code} {r.text}"

    # readonly impersonation -> same PUT should be blocked (403)
    ro_tok = requests.post(
        f"{API}/admin/impersonate/{merchant_row['user_id']}", headers=h
    ).json()["token"]
    r2 = requests.put(
        f"{API}/users/me",
        json={"phone": "+18685550000"},
        headers={"Authorization": f"Bearer {ro_tok}"}, timeout=30,
    )
    assert r2.status_code == 403, f"read-only impersonation should be 403, got {r2.status_code} {r2.text}"


# ---------- non-admin can't hit these ----------
def test_manage_requires_admin():
    driver_tok = _login(DRIVER_EMAIL, DRIVER_PASSWORD)
    r = requests.get(
        f"{API}/admin/users/whatever/manage",
        headers={"Authorization": f"Bearer {driver_tok}"}, timeout=30,
    )
    assert r.status_code in (401, 403)

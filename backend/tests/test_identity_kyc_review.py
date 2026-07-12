"""Iteration 11 review tests for Stripe Identity automated KYC.

Covers the 5 backend scenarios from the review request:
1. /api/drivers/identity/start requires an existing driver application (400 then 200).
2. /api/drivers/identity/status returns reconciled status; requires auth.
3. Driver remains 'pending' until verified — online toggle 403, user_type still 'customer'.
4. Admin manual fallback /api/admin/drivers/{id}/approve still activates+promotes.
5. /api/admin/pending-approvals exposes row.raw.identity_verification.status.
"""
import time
import uuid
import requests

from conftest import BASE_URL


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    if user_type in ("admin", "agent"):
        lr = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": "tracyfortune@islandhoptt.com", "password": "IslandHopAdmin2026!"}, timeout=30)
        assert lr.status_code == 200, f"owner admin login failed: {lr.text}"
        return lr.json()
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _ts():
    return f"{int(time.time())}_{uuid.uuid4().hex[:6]}"


# ---------- Scenario 1: identity start requires application ----------
def test_identity_start_requires_application():
    tok = _register(f"rev_noapp_{_ts()}@gmail.com")["access_token"]
    r = requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=30)
    assert r.status_code == 400, r.text


def test_identity_start_after_application_returns_stripe_url():
    tok = _register(f"rev_apply_{_ts()}@gmail.com")["access_token"]
    r = requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(tok),
        json={"license_number": "DL-REV1", "vehicle_type": "car", "vehicle_plate": "REV1"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["url"].startswith("https://verify.stripe.com"), body
    assert body["status"] == "requires_input"
    assert body.get("session_id", "").startswith("vs_")


# ---------- Scenario 2: identity status reconcile + auth required ----------
def test_identity_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/drivers/identity/status", timeout=30)
    assert r.status_code in (401, 403), r.text


def test_identity_status_reconcile_incomplete():
    tok = _register(f"rev_status_{_ts()}@gmail.com")["access_token"]
    requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(tok),
        json={"license_number": "DL-S", "vehicle_type": "car", "vehicle_plate": "S1"},
        timeout=30,
    )
    requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=60)
    r = requests.get(f"{BASE_URL}/api/drivers/identity/status", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("verified") is False
    assert "status" in body
    assert "session_id" in body and body["session_id"]


# ---------- Scenario 3: pending until verified ----------
def test_driver_remains_pending_after_identity_started():
    creds = _register(f"rev_pending_{_ts()}@gmail.com")
    tok = creds["access_token"]
    requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(tok),
        json={"license_number": "DL-P", "vehicle_type": "car", "vehicle_plate": "P1"},
        timeout=30,
    )
    requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=60)
    # cannot go online
    r = requests.put(
        f"{BASE_URL}/api/drivers/status?status=online", headers=_hdr(tok), timeout=30
    )
    assert r.status_code == 403, r.text
    # /auth/me still customer
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200
    assert r.json()["user_type"] == "customer"


# ---------- Scenario 4: admin fallback approval ----------
def test_admin_fallback_approval_still_works():
    drv = _register(f"rev_fb_drv_{_ts()}@gmail.com")
    dtok = drv["access_token"]
    r = requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(dtok),
        json={"license_number": "DL-FB", "vehicle_type": "car", "vehicle_plate": "FB1"},
        timeout=30,
    )
    assert r.status_code == 200
    driver_id = r.json()["id"]
    # start identity but don't complete -> stays pending
    requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(dtok), timeout=60)

    adm = _register(f"rev_fb_adm_{_ts()}@gmail.com", user_type="admin")
    atok = adm["access_token"]

    r = requests.post(
        f"{BASE_URL}/api/admin/drivers/{driver_id}/approve",
        headers={**_hdr(atok), "Content-Type": "application/json"},
        json={"notes": "manual override"},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    # auth/me should be 'driver' now
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(dtok), timeout=30)
    assert r.status_code == 200
    assert r.json()["user_type"] == "driver", r.json()

    # online toggle 200
    r = requests.put(
        f"{BASE_URL}/api/drivers/status?status=online", headers=_hdr(dtok), timeout=30
    )
    assert r.status_code == 200, r.text


# ---------- Scenario 5: admin sees KYC status in pending-approvals ----------
def test_admin_pending_approvals_includes_identity_verification():
    drv = _register(f"rev_adm_kyc_{_ts()}@gmail.com")
    dtok = drv["access_token"]
    r = requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(dtok),
        json={"license_number": "DL-AK", "vehicle_type": "car", "vehicle_plate": "AK1"},
        timeout=30,
    )
    assert r.status_code == 200
    driver_id = r.json()["id"]
    r = requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(dtok), timeout=60)
    assert r.status_code == 200

    adm = _register(f"rev_adm_view_{_ts()}@gmail.com", user_type="admin")
    atok = adm["access_token"]

    r = requests.get(
        f"{BASE_URL}/api/admin/pending-approvals", headers=_hdr(atok), timeout=30
    )
    assert r.status_code == 200, r.text
    body = r.json()
    row = next((d for d in body.get("drivers", []) if d.get("id") == driver_id), None)
    assert row is not None, f"driver {driver_id} not found in {body.get('drivers')}"
    iv = (row.get("raw") or {}).get("identity_verification") or {}
    assert iv.get("status"), f"identity_verification.status missing: {row}"
    assert iv["status"] in ("requires_input", "processing", "verified", "canceled", "requires_action"), iv

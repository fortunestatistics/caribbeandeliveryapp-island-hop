"""Tests for Stripe Identity (automated KYC) reconciliation + auto-approval."""
import io
import time
import uuid
import requests

from conftest import BASE_URL


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_identity_requires_application_first():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    tok = _register(f"id_noapp_{ts}@gmail.com")
    r = requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=30)
    assert r.status_code == 400


def test_identity_session_start_and_status():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    tok = _register(f"id_start_{ts}@gmail.com")
    # apply first
    r = requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(tok),
        json={"license_number": "DL", "vehicle_type": "car", "vehicle_plate": "P1"},
        timeout=30,
    )
    assert r.status_code == 200
    # start identity
    r = requests.post(f"{BASE_URL}/api/drivers/identity/start", headers=_hdr(tok), timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["url"].startswith("https://verify.stripe.com")
    assert body["status"] == "requires_input"
    # status endpoint reflects it
    r = requests.get(f"{BASE_URL}/api/drivers/identity/status", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200
    assert r.json()["verified"] is False


def test_apply_identity_result_auto_approves(monkeypatch):
    """Unit-test the reconciliation helper: a 'verified' session auto-approves
    the driver and promotes the user to driver."""
    import asyncio
    import server

    class FakeColl:
        def __init__(self):
            self.updates = []
        async def update_one(self, query, update):
            self.updates.append((query, update))
            return None

    drivers = FakeColl()
    users = FakeColl()
    monkeypatch.setattr(server.db, "drivers", drivers, raising=False)
    monkeypatch.setattr(server.db, "users", users, raising=False)

    driver = {"id": "drv1", "user_id": "usr1", "status": "pending"}
    session = {"id": "vs_1", "status": "verified", "last_error": None}

    status = asyncio.get_event_loop().run_until_complete(
        server._apply_identity_result(driver, session)
    )
    assert status == "verified"
    # driver updated to active
    drv_update = drivers.updates[0][1]["$set"]
    assert drv_update["status"] == "active"
    assert drv_update["identity_verification"]["status"] == "verified"
    # user promoted to driver
    assert users.updates[0][1]["$set"]["user_type"] == "driver"

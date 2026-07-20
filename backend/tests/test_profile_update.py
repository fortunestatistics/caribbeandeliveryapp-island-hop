"""Tests for customer profile update (picture + address + phone)."""
import time
import uuid
import requests

from conftest import BASE_URL


def _register(email, password="Test1234!", name="Profile QA"):
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_update_profile_picture_and_address():
    email = f"prof_{int(time.time())}_{uuid.uuid4().hex[:6]}@gmail.com"
    tok = _register(email)
    payload = {
        "phone": "+18681234567",
        "picture": "data:image/jpeg;base64,/9j/4AAQSkZ",
        "address": {"street": "12 Ariapita Ave", "city": "Port of Spain", "country": "Trinidad & Tobago"},
    }
    r = requests.put(f"{BASE_URL}/api/users/me", headers=_hdr(tok), json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["phone"] == "+18681234567"
    assert d["address"]["street"] == "12 Ariapita Ave"
    assert d["picture"].startswith("data:image/jpeg")

    # persisted
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=30).json()
    assert me["address"]["city"] == "Port of Spain"


def test_update_profile_requires_auth():
    r = requests.put(f"{BASE_URL}/api/users/me", json={"phone": "x"}, timeout=30)
    assert r.status_code in (401, 403), r.text


def test_update_profile_rejects_oversized_picture():
    email = f"profbig_{int(time.time())}_{uuid.uuid4().hex[:6]}@gmail.com"
    tok = _register(email)
    big = "data:image/jpeg;base64," + ("A" * 3_000_001)
    r = requests.put(f"{BASE_URL}/api/users/me", headers=_hdr(tok), json={"picture": big}, timeout=60)
    assert r.status_code == 413, r.text


def test_update_profile_partial_no_fields_is_noop():
    email = f"profnoop_{int(time.time())}_{uuid.uuid4().hex[:6]}@gmail.com"
    tok = _register(email)
    r = requests.put(f"{BASE_URL}/api/users/me", headers=_hdr(tok), json={}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == email

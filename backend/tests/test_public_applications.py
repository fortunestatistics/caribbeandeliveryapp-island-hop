"""Regression tests for the public application intake endpoints
(external leads from islandhoptt.com). Run against the live preview backend.

These hit the real DB; each test cleans up after itself.
"""
import os
import uuid
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/") + "/api"
API_KEY = os.environ.get("PUBLIC_APPLICATIONS_API_KEY", "ihtt_pub_GU4x1SizzZCs3sDkf1YJ12mWnM700Eb96HwX2Wx824c")
ADMIN = {"email": "tracyfortune@islandhoptt.com", "password": "IslandHopAdmin2026!"}


def _admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def test_driver_application_creates_pending_lead():
    email = f"pytest_drv_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/public/applications/driver", json={
        "full_name": "PyTest Driver", "email": email, "phone": "+18681112222",
        "vehicle_type": "car", "license_number": "TT-1", "vehicle_plate": "AB-1",
    }, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True and body.get("id")
    # appears in admin pending-approvals with source tag
    tok = _admin_token()
    pa = requests.get(f"{API}/admin/pending-approvals", headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
    match = [d for d in pa["drivers"] if d.get("email") == email]
    assert match and match[0]["source"] == "islandhoptt.com" and match[0]["status"] == "pending"


def test_merchant_application_with_api_key():
    email = f"pytest_mrc_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/public/applications/merchant",
                      headers={"X-API-Key": API_KEY}, json={
        "business_name": "PyTest Eats", "owner_name": "Owner", "email": email,
        "phone": "+18683334444", "business_type": "restaurant", "category": "caribbean",
        "address": "1 Main St", "city": "POS",
    }, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    tok = _admin_token()
    pa = requests.get(f"{API}/admin/pending-approvals", headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
    match = [b for b in pa["businesses"] if b.get("email") == email]
    assert match and match[0]["source"] == "islandhoptt.com"


def test_invalid_api_key_rejected():
    r = requests.post(f"{API}/public/applications/driver",
                      headers={"X-API-Key": "WRONG"}, json={
        "full_name": "x", "email": "x@x.com", "phone": "1", "vehicle_type": "car",
    }, timeout=30)
    assert r.status_code == 401


def test_honeypot_silently_accepted_not_stored():
    email = f"pytest_hp_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/public/applications/driver", json={
        "full_name": "Bot", "email": email, "phone": "1", "vehicle_type": "car",
        "hp": "http://spam",
    }, timeout=30)
    assert r.status_code == 200 and r.json()["success"] is True
    tok = _admin_token()
    pa = requests.get(f"{API}/admin/pending-approvals", headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
    assert not [d for d in pa["drivers"] if d.get("email") == email], "honeypot lead must not be stored"

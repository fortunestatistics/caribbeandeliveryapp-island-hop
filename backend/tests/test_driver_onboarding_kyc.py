"""E2E tests for driver KYC document upload + admin approval flow."""
import io
import time
import uuid
import requests

from conftest import BASE_URL


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    if user_type in ("admin", "agent"):
        lr = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": "tracyfortune@islandhoptt.com", "password": "IslandHopAdmin2026!"}, timeout=30)
        assert lr.status_code == 200, f"owner admin login failed: {lr.text}"
        return lr.json()["access_token"]
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_driver_kyc_full_flow():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    applicant = _register(f"kyc_drv_{ts}@gmail.com")
    admin = _register(f"kyc_adm_{ts}@gmail.com", password="Admin1234!", user_type="admin")

    # Upload a document
    files = {"file": ("license.png", io.BytesIO(b"FAKE_ID_BYTES"), "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/drivers/documents",
        headers=_hdr(applicant),
        data={"doc_type": "driversLicense"},
        files=files,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    doc_id = r.json()["document_id"]

    # Submit application -> should be pending
    r = requests.post(
        f"{BASE_URL}/api/drivers",
        headers=_hdr(applicant),
        json={
            "license_number": "DL-1",
            "vehicle_type": "car",
            "vehicle_plate": "ABC1",
            "documents": {"driversLicense": doc_id},
            "personal_info": {"full_name": "QA Driver"},
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    driver = r.json()
    assert driver["status"] == "pending"
    assert driver["documents"]["driversLicense"] == doc_id
    driver_id = driver["id"]

    # Cannot go online while pending
    r = requests.put(f"{BASE_URL}/api/drivers/status", json={"status": "online"}, headers=_hdr(applicant), timeout=30)
    assert r.status_code == 403

    # Owner can download own doc; other user cannot
    r = requests.get(f"{BASE_URL}/api/drivers/documents/{doc_id}/download", headers=_hdr(applicant), timeout=30)
    assert r.status_code == 200
    other = _register(f"kyc_other_{ts}@gmail.com")
    r = requests.get(f"{BASE_URL}/api/drivers/documents/{doc_id}/download", headers=_hdr(other), timeout=30)
    assert r.status_code == 403

    # Admin sees the application with documents and can view the doc
    r = requests.get(f"{BASE_URL}/api/admin/pending-approvals", headers=_hdr(admin), timeout=30)
    assert r.status_code == 200
    drivers = r.json()["drivers"]
    row = next(x for x in drivers if x["id"] == driver_id)
    assert row["raw"]["documents"]["driversLicense"] == doc_id
    r = requests.get(f"{BASE_URL}/api/drivers/documents/{doc_id}/download", headers=_hdr(admin), timeout=30)
    assert r.status_code == 200

    # Approve -> applicant becomes a driver and can go online
    r = requests.post(
        f"{BASE_URL}/api/admin/drivers/{driver_id}/approve",
        headers=_hdr(admin), json={"notes": "ok"}, timeout=30,
    )
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(applicant), timeout=30)
    assert r.json()["user_type"] == "driver"
    r = requests.put(f"{BASE_URL}/api/drivers/status", json={"status": "online"}, headers=_hdr(applicant), timeout=30)
    assert r.status_code == 200


def test_upload_rejects_invalid_doc_type():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    applicant = _register(f"kyc_inv_{ts}@gmail.com")
    files = {"file": ("x.png", io.BytesIO(b"x"), "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/drivers/documents",
        headers=_hdr(applicant),
        data={"doc_type": "passport"},
        files=files,
        timeout=60,
    )
    assert r.status_code == 400


def test_document_upload_requires_auth():
    files = {"file": ("x.png", io.BytesIO(b"x"), "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/drivers/documents",
        data={"doc_type": "driversLicense"},
        files=files,
        timeout=60,
    )
    assert r.status_code in (401, 403)

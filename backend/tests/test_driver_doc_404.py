"""Additional test: GET /api/drivers/documents/{id}/download returns 404 for non-existent id."""
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


def test_download_nonexistent_document_returns_404():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    token = _register(f"kyc_404_{ts}@gmail.com")
    bogus = str(uuid.uuid4())
    r = requests.get(
        f"{BASE_URL}/api/drivers/documents/{bogus}/download",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_download_nonexistent_document_as_admin_returns_404():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    admin = _register(f"kyc_adm404_{ts}@gmail.com", password="Admin1234!", user_type="admin")
    bogus = str(uuid.uuid4())
    r = requests.get(
        f"{BASE_URL}/api/drivers/documents/{bogus}/download",
        headers={"Authorization": f"Bearer {admin}"},
        timeout=30,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

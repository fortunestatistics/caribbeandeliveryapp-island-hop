"""Iteration 74 — Admin applicant reply tooling:
   - POST /api/admin/applicants/ai-suggestions with tone_style (friendly/firm/brief)
   - Reply favourites CRUD (/api/admin/reply-favourites)
   - DELETE /api/admin/records/{category}/{record_id}
"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def shared_lengths():
    return {}


def _mongo():
    from pymongo import MongoClient
    cfg = {}
    for line in Path("/app/backend/.env").read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    client = MongoClient(cfg["MONGO_URL"])
    return client, client[cfg["DB_NAME"]]


@pytest.fixture
def throwaway_record():
    """Insert a clearly-fake service_pro application straight into Mongo, hand its id
    to the test, then make sure it is gone afterwards."""
    client, db = _mongo()
    rec_id = f"TEST_qa74_{uuid.uuid4().hex[:8]}"
    db.service_pro_applications.insert_one({
        "id": rec_id,
        "name": "TEST_QA Throwaway Applicant",
        "email": f"{rec_id}@test.com",
        "phone": "+18680000000",
        "service_type": "handyman",
        "city": "Port of Spain",
        "status": "pending",
        "created_at": "2026-07-01T00:00:00+00:00",
    })
    try:
        yield ("service_pros", rec_id)
    finally:
        db.service_pro_applications.delete_one({"id": rec_id})
        client.close()


@pytest.fixture(scope="module")
def creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    m = re.search(r"`(admin\.qa@islandhop-demo\.com)`.*?`(AdminQA1234!)`", content)
    if not m:
        pytest.fail("admin QA credentials not found in test_credentials.md")
    return {"email": m.group(1), "password": m.group(2)}


@pytest.fixture(scope="module")
def admin(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("access_token")
    assert token, "no access_token in login response"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# --- AI suggestions with tone_style -----------------------------------------
@pytest.mark.parametrize("tone", ["friendly", "firm", "brief"])
def test_ai_suggestions_tone(admin, tone, shared_lengths):
    r = admin.post(f"{BASE_URL}/api/admin/applicants/ai-suggestions", json={
        "channel": "email",
        "applicant_name": "QA Tester",
        "applicant_type": "driver",
        "context": "I sent my licence last week, any update?",
        "tone_style": tone,
    }, timeout=120)
    assert r.status_code == 200, f"{tone}: {r.status_code} {r.text[:300]}"
    sug = r.json().get("suggestions")
    assert isinstance(sug, list) and len(sug) == 3, f"{tone}: expected 3 got {sug}"
    assert all(isinstance(s, str) and len(s.strip()) > 10 for s in sug)
    shared_lengths[tone] = sum(len(s) for s in sug) / 3.0


def test_brief_is_shorter(shared_lengths):
    if not {"friendly", "brief"} <= set(shared_lengths):
        pytest.skip("tone tests did not both run")
    assert shared_lengths["brief"] < shared_lengths["friendly"], (
        f"brief not shorter: {shared_lengths}")


def test_ai_suggestions_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/applicants/ai-suggestions",
                      json={"channel": "email"}, timeout=60)
    assert r.status_code in (401, 403), r.status_code


# --- Reply favourites CRUD ---------------------------------------------------
def test_reply_favourites_crud(admin):
    body = "TEST_QA test canned reply — please ignore"
    r = admin.post(f"{BASE_URL}/api/admin/reply-favourites", json={"body": body}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data.get("success") is True
    fav = data.get("favourite") or {}
    fav_id = fav.get("id")
    assert fav_id and fav["body"] == body
    assert "_id" not in fav

    try:
        g = admin.get(f"{BASE_URL}/api/admin/reply-favourites", timeout=60)
        assert g.status_code == 200
        favs = g.json()["favourites"]
        assert any(f["id"] == fav_id and f["body"] == body for f in favs)
        assert all("_id" not in f for f in favs)
    finally:
        d = admin.delete(f"{BASE_URL}/api/admin/reply-favourites/{fav_id}", timeout=60)
        assert d.status_code == 200, d.text[:200]

    g2 = admin.get(f"{BASE_URL}/api/admin/reply-favourites", timeout=60)
    assert all(f["id"] != fav_id for f in g2.json()["favourites"]), "favourite not deleted"


def test_reply_favourite_empty_body_rejected(admin):
    r = admin.post(f"{BASE_URL}/api/admin/reply-favourites", json={"body": "   "}, timeout=60)
    assert r.status_code == 400, r.status_code


def test_reply_favourites_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/reply-favourites", timeout=60)
    assert r.status_code in (401, 403), r.status_code


# --- Record delete -----------------------------------------------------------
def test_delete_record_unknown_id_404(admin):
    r = admin.delete(f"{BASE_URL}/api/admin/records/drivers/{uuid.uuid4()}", timeout=60)
    assert r.status_code == 404, f"{r.status_code} {r.text[:200]}"


def test_delete_record_unknown_category_404(admin):
    r = admin.delete(f"{BASE_URL}/api/admin/records/not_a_category/abc", timeout=60)
    assert r.status_code == 404, r.status_code


def test_delete_record_unauthenticated():
    r = requests.delete(f"{BASE_URL}/api/admin/records/drivers/{uuid.uuid4()}", timeout=60)
    assert r.status_code in (401, 403), r.status_code


def test_delete_throwaway_record(admin, throwaway_record):
    """Create a throwaway service_pro application via Mongo, delete it via the API."""
    category, rec_id = throwaway_record
    listing = admin.get(f"{BASE_URL}/api/admin/records/{category}", timeout=60)
    assert listing.status_code == 200, listing.text[:200]
    ids = [x.get("id") for x in listing.json().get("records", [])]
    assert rec_id in ids, "throwaway record not visible in listing before delete"

    d = admin.delete(f"{BASE_URL}/api/admin/records/{category}/{rec_id}", timeout=60)
    assert d.status_code == 200, d.text[:300]
    assert d.json().get("success") is True

    listing2 = admin.get(f"{BASE_URL}/api/admin/records/{category}", timeout=60)
    ids2 = [x.get("id") for x in listing2.json().get("records", [])]
    assert rec_id not in ids2, "record still present after delete"

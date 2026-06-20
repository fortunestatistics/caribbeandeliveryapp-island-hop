"""Tests for merchant reviews (rating + comment + merchant reply)."""
import time
import uuid
import requests

from conftest import BASE_URL


def _register(name="Reviewer"):
    email = f"rev_{int(time.time())}_{uuid.uuid4().hex[:6]}@gmail.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Test1234!", "name": name},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"], email


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_create_and_list_merchant_review():
    mid = f"merchant_{uuid.uuid4().hex[:8]}"
    tok, _ = _register("Alice")
    r = requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", headers=_hdr(tok),
                      json={"rating": 5, "comment": "Excellent service!"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["rating"] == 5

    g = requests.get(f"{BASE_URL}/api/merchants/{mid}/reviews", timeout=30).json()
    assert g["summary"]["count"] == 1
    assert g["summary"]["average"] == 5.0
    assert g["summary"]["distribution"]["5"] == 1
    assert g["can_reply"] is False  # public/unauthed viewer
    assert len(g["reviews"]) == 1


def test_review_rating_validation():
    mid = f"merchant_{uuid.uuid4().hex[:8]}"
    tok, _ = _register()
    r = requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", headers=_hdr(tok),
                      json={"rating": 9}, timeout=30)
    assert r.status_code == 400, r.text


def test_review_requires_auth():
    mid = f"merchant_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", json={"rating": 4}, timeout=30)
    assert r.status_code in (401, 403), r.text


def test_review_upsert_updates_existing():
    mid = f"merchant_{uuid.uuid4().hex[:8]}"
    tok, _ = _register()
    requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", headers=_hdr(tok),
                  json={"rating": 3, "comment": "ok"}, timeout=30)
    requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", headers=_hdr(tok),
                  json={"rating": 5, "comment": "much better"}, timeout=30)
    g = requests.get(f"{BASE_URL}/api/merchants/{mid}/reviews", timeout=30).json()
    assert g["summary"]["count"] == 1  # same customer -> updated, not duplicated
    assert g["summary"]["average"] == 5.0


def test_reply_requires_merchant_or_admin():
    mid = f"merchant_{uuid.uuid4().hex[:8]}"
    tok, _ = _register()
    cr = requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews", headers=_hdr(tok),
                       json={"rating": 4, "comment": "good"}, timeout=30).json()
    rid = cr["id"]
    # a random customer cannot reply
    r = requests.post(f"{BASE_URL}/api/merchants/{mid}/reviews/{rid}/reply", headers=_hdr(tok),
                      json={"reply": "thanks"}, timeout=30)
    assert r.status_code == 403, r.text
